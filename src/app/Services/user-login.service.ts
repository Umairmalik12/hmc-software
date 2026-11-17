import { LoadingService } from './loading.service';
import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface StaffIdentity { id: string; name: string; email: string; }

@Injectable({
  providedIn: 'root'
})
export class UserLoginService {
  private loggedIn = false;

  constructor(private supabase: SupabaseClientService, private loading: LoadingService = new LoadingService()) {}

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

    }, 2);
  }

  async restoreSession(): Promise<boolean> {
    return this.loading.track('Restoring session...', async () => {
      const { data, error } = await this.supabase.client.auth.getSession();
      if (error) {
        throw new Error(error.message);
      }
      this.loggedIn = !!data.session;
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
        return undefined;
      }
      const { data: role, error: roleError } = await this.supabase.client
        .from('hmc_user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (roleError) {
        throw new Error(roleError.message);
      }
      return role?.role || 'staff';

    }, -1);
  }
}
