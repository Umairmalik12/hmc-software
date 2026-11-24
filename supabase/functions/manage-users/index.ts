import { createClient } from 'npm:@supabase/supabase-js@2.109.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return reply(503, { error: 'Account management is not configured on the server.' });
    const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply(401, { error: 'Sign in to manage accounts.' });
    const { data: identity, error: authError } = await server.auth.getUser(token);
    if (authError || !identity.user) return reply(401, { error: 'Your session expired. Sign in again.' });
    const { data: role, error: roleError } = await server.from('hmc_user_roles').select('role').eq('user_id', identity.user.id).maybeSingle();
    if (roleError) return reply(503, { error: 'Account permissions could not be checked.' });
    if (role?.role !== 'admin') return reply(403, { error: 'Only administrators can manage team accounts.' });
    const body = await request.json();
    if (body.action === 'list') {
      const page = Number(body.page || 1);
      if (!Number.isSafeInteger(page) || page < 1) return reply(400, { error: 'Invalid page.' });
      const { data, error } = await server.auth.admin.listUsers({ page, perPage: 50 });
      if (error) throw error;
      const ids = data.users.map(user => user.id);
      const { data: roles, error: rolesError } = ids.length ? await server.from('hmc_user_roles').select('user_id,role').in('user_id', ids) : { data: [], error: null };
      if (rolesError) throw rolesError;
      return reply(200, { users: data.users.map(user => ({ id: user.id, email: user.email || '', name: user.user_metadata?.full_name || user.user_metadata?.name || '', role: roles?.find(row => row.user_id === user.id)?.role || 'staff', createdAt: user.created_at, lastSignInAt: user.last_sign_in_at || '' })), hasMore: data.users.length === 50 });
    }
    if (!['create', 'update'].includes(body.action)) return reply(400, { error: 'Unknown account action.' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: 'Enter a valid email address.' });
    if (name.length > 120 || (body.action === 'create' && !name)) return reply(400, { error: 'Enter a name up to 120 characters.' });
    if ((body.action === 'create' || password) && (password.length < 8 || password.length > 128)) return reply(400, { error: 'Use a password with 8 to 128 characters.' });
    if (body.action === 'create') {
      const accountRole = body.role || 'staff';
      if (!['admin', 'staff'].includes(accountRole)) return reply(400, { error: 'Choose Admin or Staff.' });
      const { data, error } = await server.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) throw error || new Error('Account could not be created.');
      const { error: saveRoleError } = await server.from('hmc_user_roles').upsert({ user_id: data.user.id, role: accountRole });
      if (saveRoleError) {
        // A failed role assignment must not leave a newly created login behind.
        const { error: rollbackError } = await server.auth.admin.deleteUser(data.user.id);
        if (rollbackError) return reply(500, { error: 'Account was created but its role could not be saved. Refresh the list before retrying.' });
        throw saveRoleError;
      }
      return reply(200, { id: data.user.id });
    }
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return reply(400, { error: 'Invalid account.' });
    const { data: target, error: targetError } = await server.auth.admin.getUserById(body.id);
    if (targetError || !target.user) return reply(404, { error: 'Account could not be found. Refresh the list.' });
    const { error } = await server.auth.admin.updateUserById(body.id, { email, email_confirm: true, user_metadata: { ...target.user.user_metadata, full_name: name }, ...(password ? { password } : {}) });
    if (error) throw error;
    return reply(200, { id: body.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account request failed.';
    return reply(400, { error: message });
  }
});
