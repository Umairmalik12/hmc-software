import { LoadingService } from './loading.service';
import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { NotifyUpdateService } from './notify-update.service';

export interface StaffIdentity { id: string; name: string; email: string; }

@Injectable({
  providedIn: 'root'
})
export class UserLoginService {
  private loggedIn = false;
  private lastRole?: { userId: string; role: string };

  constructor(private supabase: SupabaseClientService, private loading: LoadingService = new LoadingService(), private feedback: NotifyUpdateService = new NotifyUpdateService()) {}

  async SignIn(username: string, pass: string): Promise<boolean> {
    return this.loading.track('Signing in...', async () => {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: username.trim(),
        password: pass,
      });
      if (error) {
        throw new Error(error.message);
      }
      this.loggedIn = !!data.session;
      this.feedback.setUser(data.session?.user?.id || null);
      return this.loggedIn;

    }, 2);
  }

  async SignOut(): Promise<void> {
    return this.loading.track('Signing out...', async () => {
      const { error } = await this.supabase.client.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
      this.loggedIn = false;
      this.lastRole = undefined;
      this.feedback.setUser(null);

    }, 2);
  }

  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    return this.loading.track('Updating password...', async () => {
      if (!email.trim() || !currentPassword) throw new Error('Enter your email and current password.');
      if (newPassword.length < 8 || newPassword.length > 128) throw new Error('Use 8–128 characters for the new password.');
      if (newPassword === currentPassword) throw new Error('Choose a new password different from your current password.');
      const client = this.supabase.createPasswordChangeClient();
      try {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: currentPassword });
        if (error) {
          if (error.code === 'invalid_credentials') throw new Error('The email or current password is incorrect.');
          throw new Error(error.message);
        }
        if (!data.session || !data.user) throw new Error('Your account could not be verified. Please try again.');
        const { data: updated, error: updateError } = await client.auth.updateUser({ password: newPassword, current_password: currentPassword });
        if (updateError) throw new Error(updateError.message);
        if (updated.user?.id !== data.user.id) throw new Error('The password update could not be confirmed. Please try again.');
      } finally {
        // Revoke only this temporary session. Passwords and tokens are never
        // written to HMC records, localStorage or the application login session.
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* The client uses memory storage only. */ }
      }
    }, 2);
  }

  async restoreSession(): Promise<boolean> {
    return this.loading.track('Restoring session...', async () => {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (error) {
        throw new Error(error.message);
      }
      this.loggedIn = !!data.session;
      this.feedback.setUser(data.session?.user?.id || null);
      return this.loggedIn;

    }, 0);
  }

  async isAuthenticated(): Promise<boolean> {
    return this.restoreSession();
  }

  get status(): boolean {
    return this.loggedIn;
  }

  async getStaffIdentity(): Promise<StaffIdentity> {
    return this.loading.track('Loading staff details...', async () => {
      const { data, error } = await this.supabase.client.auth.getUser();
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Sign in again to record payments.');
      this.feedback.setUser(data.user.id);
      const metadata = data.user.user_metadata || {};
      const name = [metadata['full_name'], metadata['name'], metadata['display_name'], data.user.email]
        .find(value => typeof value === 'string' && value.trim());
      return { id: data.user.id, name: name?.trim() || '', email: data.user.email || '' };

    }, -1);
  }

  async getLoginUser(): Promise<string | undefined> {
    return this.loading.track('Loading account...', async () => {
      const { data, error } = await this.supabase.client.auth.getUser();
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        this.feedback.setUser(null);
        return undefined;
      }
      this.feedback.setUser(data.user.id);
      const { data: role, error: roleError } = await this.supabase.client
        .from('hmc_user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (roleError) {
        throw new Error(roleError.message);
      }
      const currentRole = typeof role?.role === 'string' ? role.role.trim().toLowerCase() : '';
      if (!currentRole) {
        throw new Error('Your account has no assigned role. Ask an administrator to configure your account role.');
      }
      if (this.lastRole?.userId === data.user.id && this.lastRole.role !== currentRole) {
        this.feedback.info('Your account role was updated to ' + currentRole + '.', { title: 'Account permissions updated', route: '/home' });
      }
      this.lastRole = { userId: data.user.id, role: currentRole };
      return currentRole;

    }, -1);
  }
}
