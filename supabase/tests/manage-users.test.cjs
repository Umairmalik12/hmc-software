const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../functions/manage-users/index.ts'), 'utf8').replace(/^import .*;\r?\n/, '');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function setup(role = 'admin', roleSaveError = null) {
  const writes = [];
  const server = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role } }) }), in: async () => ({ data: [] }) }), upsert: async value => { writes.push(['role', value]); return { error: roleSaveError }; } }),
    auth: {
      getUser: async token => token === 'valid' ? { data: { user: { id: 'admin-id' } } } : { data: {}, error: new Error('Invalid JWT') },
      admin: {
        listUsers: async () => { writes.push(['list']); return { data: { users: [] } }; },
        createUser: async value => { writes.push(['create', value]); return { data: { user: { id: 'new-id' } } }; },
        deleteUser: async id => { writes.push(['rollback', id]); return {}; },
        getUserById: async () => ({ data: { user: { user_metadata: { department: 'OPD' } } } }),
        updateUserById: async (id, value) => { writes.push(['update', id, value]); return {}; },
      },
    },
  };
  let handler;
  vm.runInNewContext(code, { Request, Response, createClient: () => server, Deno: { env: { get: () => 'server-secret' }, serve: fn => { handler = fn; } } });
  return { writes, call: async (body, token = 'valid') => handler(new Request('https://hmc.test/manage-users', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) };
}

test('staff and invalid sessions cannot list or change any account', async () => {
  for (const action of ['list', 'create', 'update']) {
    const staff = setup('staff');
    assert.equal((await staff.call({ action })).status, 403);
    assert.deepEqual(staff.writes, []);
    const anonymous = setup();
    assert.equal((await anonymous.call({ action }, 'invalid')).status, 401);
    assert.deepEqual(anonymous.writes, []);
  }
});
test('admin creates a confirmed login and persists the role separately', async () => {
  const env = setup();
  assert.equal((await env.call({ action: 'create', name: 'Counter staff', email: 'staff@example.test', password: 'SecurePassword1', role: 'staff' })).status, 200);
  assert.equal(env.writes[0][0], 'create');
  assert.equal(env.writes[0][1].email_confirm, true);
  assert.equal(env.writes[0][1].password, 'SecurePassword1');
  assert.equal(env.writes[1][1].user_id, 'new-id');
  assert.equal(env.writes[1][1].role, 'staff');
  assert.equal('password' in env.writes[1][1], false);
});
test('a failed role assignment removes the newly created login', async () => {
  const env = setup('admin', new Error('Role failed'));
  assert.equal((await env.call({ action: 'create', name: 'Staff', email: 'staff@example.test', password: 'SecurePassword1' })).status, 400);
  assert.deepEqual(env.writes.at(-1), ['rollback', 'new-id']);
});
test('email updates preserve metadata and do not replace a blank password or change roles', async () => {
  const env = setup();
  assert.equal((await env.call({ action: 'update', id: '11111111-1111-1111-1111-111111111111', name: 'Ali', email: 'updated@example.test', password: '', role: 'staff' })).status, 200);
  const update = env.writes[0][2];
  assert.equal(update.email, 'updated@example.test');
  assert.equal(update.email_confirm, true);
  assert.equal(update.user_metadata.department, 'OPD');
  assert.equal(update.user_metadata.full_name, 'Ali');
  assert.equal('password' in update, false);
  assert.equal(env.writes.length, 1);
});
test('password resets go directly to Auth without leaking into responses', async () => {
  const env = setup();
  const response = await env.call({ action: 'update', id: '11111111-1111-1111-1111-111111111111', name: 'Ali', email: 'ali@example.test', password: 'NewPassword123' });
  assert.equal(response.status, 200);
  assert.equal(env.writes[0][2].password, 'NewPassword123');
  assert.equal((await response.text()).includes('NewPassword123'), false);
});
test('invalid role and short passwords are rejected before any write', async () => {
  const env = setup();
  for (const changes of [{ role: 'owner' }, { password: 'short' }]) {
    const response = await env.call({ action: 'create', name: 'Staff', email: 'staff@example.test', password: 'SecurePassword1', ...changes });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(env.writes, []);
});
