import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseClientService {
  private instance?: SupabaseClient;
  private passwordChangeClients = 0;

  createPasswordChangeClient(): SupabaseClient {
    if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
      throw new Error('Supabase is not configured. Contact the hospital administrator.');
    }
    // Reauthentication here must not sign the login page into the workspace
    // or replace a different account's saved browser session.
    return createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
        storageKey: 'hmc-password-change-' + Date.now().toString(36) + '-' + ++this.passwordChangeClients,
      },
    });
  }

  get client(): SupabaseClient {
    if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
      throw new Error(
        'Supabase is not configured. Set supabaseUrl and supabaseAnonKey in src/environments/environment.ts.'
      );
    }

    if (!this.instance) {
      this.instance = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }

    return this.instance;
  }
}
