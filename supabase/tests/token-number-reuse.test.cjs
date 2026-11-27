const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const toolsDirectory = process.env.HMC_TOKEN_TEST_TOOLS;
const root = path.resolve(__dirname, '../..');
const ADMIN = '00000000-0000-0000-0000-000000000001';
const STAFF = '00000000-0000-0000-0000-000000000002';
const DAY = '2026-11-27';

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('PostgreSQL token numbering and authorization', { skip: !toolsDirectory, timeout: 120000 }, async t => {
  const requireTools = createRequire(path.join(path.resolve(toolsDirectory),'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(requireTools.resolve('embedded-postgres')).href);
  const { Client } = requireTools('pg');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'hmc-token-tests-'));
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith('hmc-token-tests-'));
  const port = await availablePort();
  const cluster = new EmbeddedPostgres({
    databaseDir: directory, port, user: 'postgres', password: 'isolated-token-test',
    persistent: false, createPostgresUser: false, autoRehydrateSymlinks: true,
    postgresFlags: ['-h','127.0.0.1'], onLog: () => {}, onError: () => {},
  });
  const clients = new Set();
  let started = false;
  async function connect(identity,database='postgres') {
    const client = new Client({ host: '127.0.0.1',port,user:'postgres',password:'isolated-token-test',database });
    await client.connect(); clients.add(client);
    await client.query("set statement_timeout = '10s'");
    if (identity !== undefined) {
      await client.query('set role authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,false)",[identity]);
    }
    return client;
  }
  const issue = async (client,name='Patient',day=DAY,rpc='hmc_issue_patient_token') => {
    assert.ok(['hmc_issue_patient_token','create_patient_token_at'].includes(rpc));
    return (await client.query('select public.' + rpc + '($1,$2::date,$3) as token',[name,day,'10:30'])).rows[0].token;
  };
  const remove = async (client,token) => (await client.query("select public.hmc_mutate_patient_token($1,'delete') as result",[token.id])).rows[0].result;
  try {
    await cluster.initialise();
    await cluster.start(); started = true;
    const owner = await connect();
    await owner.query(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
      $$;
      create table public.hmc_user_roles(user_id uuid primary key,role text not null);
    `);
    await owner.query('insert into public.hmc_user_roles values($1,$2),($3,$4)',[ADMIN,'admin',STAFF,'staff']);
    const schema = fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
    for (const table of ['patient_token_slips','patient_token_daily_sequences']) {
      const sql = schema.match(new RegExp('create table if not exists public\\.' + table + ' \\([\\s\\S]*?\\n\\);'));
      assert.ok(sql,'Real table definition must be available');
      await owner.query(sql[0]);
    }
    const roles = fs.readFileSync(path.join(root,'supabase/simple_access_functions.sql'),'utf8');
    for (const name of ['hmc_is_admin','hmc_has_permission']) {
      const sql = roles.match(new RegExp('create or replace function public\\.' + name + '\\([^$]*?\\$\\$[\\s\\S]*?\\n\\$\\$;'));
      assert.ok(sql);
      await owner.query(sql[0]);
    }
    const migration = fs.readFileSync(path.join(root,'supabase/migrations/20261129_token_number_reuse.sql'),'utf8');
    await owner.query(migration);
    await owner.query(migration);
    const admin = await connect(ADMIN), staff = await connect(STAFF);
    const reset = () => owner.query('truncate public.patient_token_slips,public.patient_token_daily_sequences restart identity');

    await t.test('deleted middle, first and multiple numbers are reused in ascending order',async () => {
      await reset();
      const first = await issue(staff), second = await issue(staff), third = await issue(staff);
      assert.deepEqual([first.token_number,second.token_number,third.token_number],['A01','A02','A03']);
      const preserved = (await owner.query('select to_jsonb(t) as record from public.patient_token_slips t where id = $1',[third.id])).rows[0].record;
      await remove(admin,second);
      const reused = await issue(staff,'Returning patient');
      assert.equal(reused.token_number,'A02'); assert.notEqual(reused.id,second.id);
      await remove(admin,first);
      assert.equal((await issue(staff)).token_number,'A01');
      assert.deepEqual((await owner.query('select to_jsonb(t) as record from public.patient_token_slips t where id = $1',[third.id])).rows[0].record,preserved);
      await remove(admin,reused); await remove(admin,third);
      assert.deepEqual([(await issue(staff)).token_number,(await issue(staff)).token_number],['A02','A03']);
    });

    await t.test('finds A03 in 1,2,4,5 and ignores the former daily counter',async () => {
      await reset();
      const tokens = [];
      for (let i=0;i<5;i++) tokens.push(await issue(admin));
      await remove(admin,tokens[2]);
      await owner.query('insert into public.patient_token_daily_sequences values($1,100000)',[DAY]);
      assert.equal((await issue(staff)).token_number,'A03');
      assert.equal((await owner.query('select next_sequence from public.patient_token_daily_sequences')).rows[0].next_sequence,100000);
    });

    await t.test('different dates reset independently and preserve legacy numbers',async () => {
      await reset();
      const first = await issue(staff), gap = await issue(staff);
      await remove(admin,gap);
      assert.equal((await issue(staff,'Other date','2026-11-28')).token_number,'A01');
      assert.equal((await issue(staff)).token_number,'A02');
      await owner.query("update public.patient_token_slips set token_number = 'A001' where id = $1",[first.id]);
      assert.equal((await issue(staff)).token_number,'A03');
      assert.equal((await owner.query('select token_number from public.patient_token_slips where id = $1',[first.id])).rows[0].token_number,'A001');
    });

    await t.test('protects a legacy printed number even when its sequence differs',async () => {
      await reset();
      await owner.query("insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at) values('A02',8,'Historical patient',$1,'10:30 AM',now())",[DAY]);
      assert.equal((await issue(staff)).token_number,'A01');
      assert.equal((await issue(staff)).token_number,'A03');
    });

    await t.test('both legacy creation RPCs delegate to the same allocator',async () => {
      await reset();
      const first = await issue(staff,'First',DAY,'create_patient_token_at');
      await issue(staff,'Second',DAY,'create_patient_token_at');
      await remove(admin,first);
      assert.equal((await issue(staff,'Replacement',DAY,'create_patient_token_at')).token_number,'A01');
      const automatic = (await staff.query("select public.create_patient_token('Automatic') as token")).rows[0].token;
      const localDay = (await owner.query("select to_char(clock_timestamp() at time zone 'Asia/Karachi','YYYY-MM-DD') as day")).rows[0].day;
      assert.equal(automatic.token_date,localDay);
      assert.match(automatic.token_number,/^A[0-9]{2,}$/);
    });

    await t.test('formatting expands after A99 without truncation',async () => {
      await reset();
      await owner.query("insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at) select 'A'||lpad(n::text,2,'0'),n,'Existing',$1,'10:30 AM',now() from generate_series(1,99) n",[DAY]);
      assert.equal((await issue(staff)).token_number,'A100');
    });

    await t.test('concurrent clients get distinct smallest numbers',async () => {
      await reset();
      const connections = await Promise.all(Array.from({length:12},() => connect(STAFF)));
      const tokens = await Promise.all(connections.map((client,index) => issue(client,'Concurrent ' + index)));
      assert.deepEqual(tokens.map(token => token.sequence).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
      await remove(admin,tokens.find(token => token.sequence === 2));
      await remove(admin,tokens.find(token => token.sequence === 4));
      const replacements = await Promise.all(connections.slice(0,2).map(client => issue(client)));
      assert.deepEqual(replacements.map(token => token.sequence).sort((a,b)=>a-b),[2,4]);
      const counts = (await owner.query('select count(distinct sequence) as sequences,count(distinct token_number) as labels,count(*) as records from public.patient_token_slips')).rows[0];
      assert.deepEqual(Object.values(counts).map(Number),[12,12,12]);
    });

    await t.test('creation waits for deletion to commit and then reuses its number',async () => {
      await reset();
      const first = await issue(staff); await issue(staff);
      const deleting = await connect(ADMIN), creating = await connect(STAFF);
      await deleting.query('begin');
      await remove(deleting,first);
      const pending = issue(creating,'After committed deletion');
      await deleting.query('commit');
      assert.equal((await pending).token_number,'A01');
    });

    await t.test('rolled-back deletion never releases a number',async () => {
      await reset();
      const first = await issue(staff);
      const deleting = await connect(ADMIN);
      await deleting.query('begin'); await remove(deleting,first); await deleting.query('rollback');
      assert.equal((await issue(staff)).token_number,'A02');
    });

    await t.test('User can create, only Admin can edit/delete, validation leaves no rows',async () => {
      await reset();
      const first = await issue(staff);
      await assert.rejects(remove(staff,first),error => error.code === '42501');
      await assert.rejects(staff.query("select public.hmc_mutate_patient_token($1,'edit','Changed')",[first.id]),error => error.code === '42501');
      const edited = (await admin.query("select public.hmc_mutate_patient_token($1,'edit','Updated patient') as token",[first.id])).rows[0].token;
      assert.equal(edited.customer_name,'Updated patient'); assert.equal(edited.token_number,'A01');
      const unassigned = await connect('');
      await assert.rejects(issue(unassigned),error => error.code === '42501');
      await assert.rejects(issue(staff,'  '));
      await assert.rejects(staff.query("select public.hmc_issue_patient_token('Invalid',$1,'25:00')",[DAY]));
      assert.equal(Number((await owner.query('select count(*) from public.patient_token_slips')).rows[0].count),1);
    });
    await t.test('fresh full schema installs the same functions and fixed roles',async () => {
      await owner.query('create database hmc_token_schema_check');
      const fresh = await connect(undefined,'hmc_token_schema_check');
      await fresh.query("create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;");
      await fresh.query(schema);
      await fresh.query('insert into auth.users(id) values($1),($2)',[ADMIN,STAFF]);
      await fresh.query('insert into public.hmc_user_roles values($1,$2),($3,$4)',[ADMIN,'admin',STAFF,'staff']);
      const freshStaff = await connect(STAFF,'hmc_token_schema_check');
      const first = await issue(freshStaff);
      assert.equal(first.token_number,'A01');
      await assert.rejects(remove(freshStaff,first),error => error.code === '42501');
      const freshAdmin = await connect(ADMIN,'hmc_token_schema_check');
      await remove(freshAdmin,first);
      assert.equal((await issue(freshStaff)).token_number,'A01');
    });
  } finally {
    await Promise.allSettled([...clients].map(client => client.end()));
    if (started) await cluster.stop();
  }
});
