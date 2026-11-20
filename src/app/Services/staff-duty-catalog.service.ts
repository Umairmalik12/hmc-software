import { Injectable } from '@angular/core';
import { STAFF_DUTIES, StaffRecord, staffKey, uniqueStaffValues } from '../Models/staff.model';
import { STAFF_COLLECTION } from './staff.service';
import { SupabaseDataService } from './supabase-data.service';

export interface StaffDutyOption { id: string; name: string; active: boolean; previousNames?: string[]; createdAt?: string; updatedAt?: string; }
export const STAFF_DUTY_CATALOG = 'staffDutyCatalog';
export const DEFAULT_STAFF_DUTIES: readonly StaffDutyOption[] = STAFF_DUTIES.map(name => ({ id: 'default:' + encodeURIComponent(staffKey(name)), name, active: true }));

@Injectable({ providedIn: 'root' })
export class StaffDutyCatalogService {
  readonly changes = this.db.changes;
  constructor(private db: SupabaseDataService) {}
  async getAll(includeInactive = false): Promise<StaffDutyOption[]> {
    const [stored, staff] = await Promise.all([this.db.getItem<StaffDutyOption[]>(STAFF_DUTY_CATALOG), this.db.getItem<StaffRecord[]>(STAFF_COLLECTION)]);
    const options = new Map(DEFAULT_STAFF_DUTIES.map(option => [option.id, { ...option }]));
    for (const option of Array.isArray(stored) ? stored : []) {
      if (!option?.id || typeof option.name !== 'string' || !option.name.trim()) continue;
      options.set(String(option.id), { ...option, id: String(option.id), active: option.active !== false,
        previousNames: Array.isArray(option.previousNames) ? option.previousNames.filter(name => typeof name === 'string') : [] });
    }
    // Existing custom assignments become manageable options. Prior names suppress re-import
    // after a rename/removal; the staff record itself is never rewritten.
    const known = new Set([...options.values()].flatMap(option => [option.name, ...(option.previousNames || [])]).map(staffKey));
    for (const record of Array.isArray(staff) ? staff : []) {
      for (const assignment of Array.isArray(record.assignments) ? record.assignments : []) {
        if (typeof assignment?.duty !== 'string') continue;
        const name = assignment.duty.trim().replace(/\s+/g, ' '), key = staffKey(name);
        if (!key || known.has(key)) continue;
        options.set('legacy:' + encodeURIComponent(key), { id: 'legacy:' + encodeURIComponent(key), name, active: true }); known.add(key);
      }
    }
    return [...options.values()].filter(option => includeInactive || option.active).sort((a, b) => staffKey(a.name).localeCompare(staffKey(b.name)) || a.id.localeCompare(b.id));
  }
  async save(name: string, id?: string, active = true): Promise<StaffDutyOption> {
    if (typeof name !== 'string') throw new Error('Enter a valid duty name.');
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new Error('Enter the duty name.');
    if (trimmed.length > 120) throw new Error('Duty names must be 120 characters or fewer.');
    if (typeof active !== 'boolean') throw new Error('Select an active or inactive duty status.');
    const all = await this.getAll(true), current = id ? all.find(option => option.id === id) : undefined;
    if (id && !current) throw new Error('This duty no longer exists. Refresh the duty list.');
    const duplicate = all.find(option => option.id !== id && staffKey(option.name) === staffKey(trimmed));
    if (duplicate?.active || (id && duplicate)) throw new Error('This duty already exists. Edit or restore the existing duty.');
    const previous = current || duplicate, now = new Date().toISOString();
    const option: StaffDutyOption = { ...previous, id: previous?.id || String(await this.db.allocateId(STAFF_DUTY_CATALOG)), name: trimmed, active,
      previousNames: uniqueStaffValues([...(previous?.previousNames || []), ...(previous && staffKey(previous.name) !== staffKey(trimmed) ? [previous.name] : [])]),
      createdAt: previous?.createdAt || now, updatedAt: now };
    if (previous) await this.db.upsertRecord(STAFF_DUTY_CATALOG, option.id, option); else await this.db.insertRecord(STAFF_DUTY_CATALOG, option.id, option);
    this.changes.next(STAFF_DUTY_CATALOG); return option;
  }
  async setActive(id: string, active: boolean): Promise<void> {
    const current = (await this.getAll(true)).find(option => option.id === id);
    if (!current) throw new Error('This duty no longer exists. Refresh the duty list.');
    await this.save(current.name, current.id, active);
  }
}
