import { Injectable } from '@angular/core';
import { SupabaseDataService } from './supabase-data.service';

export interface RoomOption { id: string; name: string; active: boolean; }
export const DEFAULT_ROOMS: readonly RoomOption[] = ['Room 1', 'Room 2', 'GW Bed 1', 'GW Bed 2']
  .map((name, index) => ({ id: 'default-' + (index + 1), name, active: true }));

@Injectable({ providedIn: 'root' })
export class RoomService {
  constructor(private db: SupabaseDataService) {}

  async getAll(includeInactive = false): Promise<RoomOption[]> {
    const stored = await this.db.getItem<RoomOption[]>('rooms');
    const options = new Map(DEFAULT_ROOMS.map(option => [option.id, { ...option }]));
    if (Array.isArray(stored)) stored.forEach(option => options.set(option.id, { ...option, active: option.active !== false }));
    return Array.from(options.values()).filter(option => includeInactive || option.active);
  }

  async save(name: string, id?: string): Promise<RoomOption> {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new Error('Enter a room or bed name.');
    if (trimmed.length > 80) throw new Error('Use 80 characters or fewer for the room or bed name.');
    const all = await this.getAll(true);
    if (id && !all.some(option => option.id === id)) throw new Error('This room or bed no longer exists. Refresh the list.');
    const duplicate = all.find(option => option.id !== id && option.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (duplicate?.active) throw new Error('This room or bed already exists.');
    const option: RoomOption = { id: id || duplicate?.id || String(await this.db.allocateId('rooms')), name: trimmed, active: true };
    await this.db.upsertRecord('rooms', option.id, option);
    return option;
  }

  async delete(option: RoomOption): Promise<void> {
    // Keep a tombstone for built-in options; historical medicine records retain their labels.
    await this.db.upsertRecord('rooms', option.id, { ...option, active: false });
  }
}
