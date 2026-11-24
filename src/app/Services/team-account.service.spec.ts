import { TeamAccountService } from './team-account.service';
import { SupabaseClientService } from './supabase-client.service';
import { AdminGuardService } from './Guard-Services/admin-guard.service';
import { AccountEditComponent } from '../Components/team-accounts/account-edit.component';
import { FormBuilder } from '@angular/forms';

describe('Team account administration', () => {
  function setup() {
    const invoke = jasmine.createSpy('invoke');
    const service = new TeamAccountService({ client: { functions: { invoke } } } as unknown as SupabaseClientService);
    return { service, invoke };
  }
  it('loads all account pages and removes repeated IDs', async () => {
    const { service, invoke } = setup();
    invoke.and.returnValues(Promise.resolve({ data: { users: [{ id: 'a' }], hasMore: true } }), Promise.resolve({ data: { users: [{ id: 'a' }, { id: 'b' }], hasMore: false } }));
    expect((await service.getAll()).map(account => account.id)).toEqual(['a', 'b']);
    expect(invoke.calls.argsFor(1)).toEqual(['manage-users', { body: { action: 'list', page: 2 } }]);
  });
  it('uses the backend function for team creation without changing the browser session', async () => {
    const { service, invoke } = setup(); invoke.and.resolveTo({ data: { id: 'new-user' } });
    await service.save({ name: 'Counter staff', email: 'staff@example.test', password: 'Password123', role: 'staff' });
    expect(invoke).toHaveBeenCalledWith('manage-users', { body: { action: 'create', name: 'Counter staff', email: 'staff@example.test', password: 'Password123', role: 'staff' } });
  });
  it('surfaces a backend authorization failure instead of treating it as saved', async () => {
    const { service, invoke } = setup();
    invoke.and.resolveTo({ error: { context: { json: async () => ({ error: 'Only administrators can manage team accounts.' }) } } });
    await expectAsync(service.save({ name: 'Staff', email: 'staff@example.test' }, 'user-id')).toBeRejectedWithError('Only administrators can manage team accounts.');
  });
  it('guards direct signup and account routes for staff and expired sessions', async () => {
    const users = { getLoginUser: jasmine.createSpy('getLoginUser') };
    const router = { createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((path: string[]) => path.join('')) };
    const guard = new AdminGuardService(users as any, router as any);
    users.getLoginUser.and.resolveTo('staff'); expect(await guard.canActivate()).toBe('/home' as any);
    users.getLoginUser.and.resolveTo('admin'); expect(await guard.canActivate()).toBeTrue();
    users.getLoginUser.and.rejectWith(new Error('Expired')); expect(await guard.canActivate()).toBe('/' as any);
  });
  it('requires a new account password and rejects a mismatched confirmation', async () => {
    const save = jasmine.createSpy('save').and.resolveTo();
    const component = new AccountEditComponent(new FormBuilder(), null, { close: jasmine.createSpy('close') } as any, { save } as any, { success: () => {}, error: () => {} } as any);
    component.form.patchValue({ name: 'Counter staff', email: 'staff@example.test' });
    await component.save(); expect(save).not.toHaveBeenCalled();
    component.form.patchValue({ password: 'Password123', confirmPassword: 'Different123' });
    await component.save(); expect(save).not.toHaveBeenCalled(); expect(component.error).toContain('do not match');
  });
  it('leaves the password unchanged when editing an email without a password reset', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const save = jasmine.createSpy('save').and.resolveTo();
    const component = new AccountEditComponent(new FormBuilder(), { id: 'a', name: 'Ali', email: 'ali@example.test', role: 'admin', createdAt: '', lastSignInAt: '' }, { close: jasmine.createSpy('close') } as any, { save } as any, { success: () => {}, error: () => {} } as any);
    component.form.patchValue({ email: 'new@example.test' });
    await component.save();
    expect(save).toHaveBeenCalledWith({ name: 'Ali', email: 'new@example.test' }, 'a');
  });
});
