import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface TeamAccount { id: string; name: string; email: string; role: string; createdAt: string; lastSignInAt: string; }
export interface AccountDraft { name: string; email: string; password?: string; role?: string; }

@Injectable({ providedIn: 'root' })
export class TeamAccountService {
  constructor(private supabase: SupabaseClientService) {}

  private async request(body: object): Promise<any> {
    const { data, error } = await this.supabase.client.functions.invoke('manage-users', { body });
    if (error) {
      let message = 'Account management is unavailable. Check that the manage-users backend function is deployed.';
      try { const response = await error.context?.json(); if (response?.error) message = response.error; } catch { /* Keep the connection message. */ }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async getAll(): Promise<TeamAccount[]> {
    const accounts = new Map<string, TeamAccount>();
    for (let page = 1; ; page++) {
      const data = await this.request({ action: 'list', page });
      if (!Array.isArray(data?.users)) throw new Error('The account list could not be loaded.');
      data.users.forEach((account: TeamAccount) => accounts.set(account.id, account));
      if (!data.hasMore) return [...accounts.values()];
    }
  }
  async save(draft: AccountDraft, id?: string): Promise<void> {
    await this.request({ action: id ? 'update' : 'create', ...draft, ...(id ? { id } : {}) });
  }
}
