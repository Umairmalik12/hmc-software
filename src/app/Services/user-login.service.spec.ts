import { UserLoginService } from './user-login.service';
import { SupabaseClientService } from './supabase-client.service';
import { NotifyUpdateService } from './notify-update.service';

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
  it('notifies account role changes once and clears the active notification history on sign-out', async () => {
    let role = 'admin';
    const feedback = new NotifyUpdateService(); const messages = jasmine.createSpy('messages'); feedback.alertNotify.subscribe(messages);
    const lookup = { select: () => lookup, eq: () => lookup, maybeSingle: async () => ({ data: { role }, error: null }) };
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'role-notification-test' } }, error: null }), signOut: async () => ({ error: null }) }, from: () => lookup };
    const service = new UserLoginService({ client } as unknown as SupabaseClientService, undefined, feedback);
    try {
      await service.getLoginUser(); await service.getLoginUser(); expect(messages).not.toHaveBeenCalled();
      role = 'staff'; await service.getLoginUser(); expect(messages).toHaveBeenCalledTimes(1);
      expect(messages.calls.mostRecent().args[0].title).toBe('Account permissions updated');
      let count = 0; feedback.unreadCount$.subscribe(value => count = value); expect(count).toBe(1);
      await service.SignOut(); expect(count).toBe(0);
    } finally { feedback.ngOnDestroy(); localStorage.removeItem('hmc.notifications.role-notification-test'); }
  });
});
