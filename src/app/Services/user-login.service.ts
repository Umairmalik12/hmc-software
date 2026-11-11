import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

@Injectable({
  providedIn: 'root'
})
export class UserLoginService {
  private loggedIn = false;

  constructor(private supabase: SupabaseClientService) {}

  async SignIn(username: string, pass: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: username.trim(),
      password: pass,
    });
    if (error) {
      throw new Error(error.message);
    }
    this.loggedIn = !!data.session;
    return this.loggedIn;
  }

  async SignOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    this.loggedIn = false;
  }

  async restoreSession(): Promise<boolean> {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) {
      throw new Error(error.message);
    }
    this.loggedIn = !!data.session;
    return this.loggedIn;
  }

  async isAuthenticated(): Promise<boolean> {
    return this.restoreSession();
  }

  get status(): boolean {
    return this.loggedIn;
  }

  async getLoginUser(): Promise<string | undefined> {
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
  }
}
