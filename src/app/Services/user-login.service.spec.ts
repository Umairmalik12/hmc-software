import { UserLoginService } from './user-login.service';
import { SupabaseClientService } from './supabase-client.service';

describe('Signed-in counter identity', () => {
  it('reads a display name and stable account ID without using role as a staff name', async () => {
    const getUser = jasmine.createSpy().and.resolveTo({ data: { user: { id: 'staff-1', email: 'staff@example.test', user_metadata: { full_name: ' Ayesha Khan ' } } }, error: null });
    const service = new UserLoginService({ client: { auth: { getUser } } } as unknown as SupabaseClientService);
    expect(await service.getStaffIdentity()).toEqual({ id: 'staff-1', name: 'Ayesha Khan', email: 'staff@example.test' });
    getUser.and.resolveTo({ data: { user: { id: 'staff-2', email: 'bilal@example.test', user_metadata: {} } }, error: null });
    expect((await service.getStaffIdentity()).name).toBe('bilal@example.test');
  });
  it('rejects an expired or failed identity lookup', async () => {
    const getUser = jasmine.createSpy().and.resolveTo({ data: { user: null }, error: null });
    const service = new UserLoginService({ client: { auth: { getUser } } } as unknown as SupabaseClientService);
    await expectAsync(service.getStaffIdentity()).toBeRejectedWithError('Sign in again to record payments.');
    getUser.and.resolveTo({ data: { user: null }, error: { message: 'Offline' } });
    await expectAsync(service.getStaffIdentity()).toBeRejectedWithError('Offline');
  });
});
