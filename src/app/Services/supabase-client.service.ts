import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseClientService {
  private instance?: SupabaseClient;

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
