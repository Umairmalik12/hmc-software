import { Injectable } from '@angular/core';
import { StaffDraft, StaffDutyAssignment, StaffRecord, dutyTimingError, staffKey } from '../Models/staff.model';
import { SupabaseDataService } from './supabase-data.service';

export const STAFF_COLLECTION = 'staffDetails';

@Injectable({ providedIn: 'root' })
export class StaffService {
  readonly changes = this.db.changes;
  constructor(private db: SupabaseDataService) {}

  async getAll(includeInactive = false): Promise<StaffRecord[]> {
    const records = await this.db.getItem<StaffRecord[]>(STAFF_COLLECTION) || [];
    return records.map(record => ({ ...record, active: record.active !== false, assignments: (record.assignments || []).map(assignment => ({ ...assignment })) }))
      .filter(record => includeInactive || record.active).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
  async getById(id: string): Promise<StaffRecord | undefined> { return (await this.getAll(true)).find(record => record.id === id); }

  async save(draft: StaffDraft, id?: string): Promise<StaffRecord> {
    const normalized = this.normalize(draft);
    const previous = id ? await this.getById(id) : undefined;
    if (id && !previous) throw new Error('This staff record no longer exists. Refresh the list.');
    const now = new Date().toISOString();
    const record: StaffRecord = { ...previous, ...normalized, id: previous?.id || String(await this.db.allocateId(STAFF_COLLECTION)), createdAt: previous?.createdAt || now, updatedAt: now };
    if (previous) await this.db.upsertRecord(STAFF_COLLECTION, record.id, record);
    else await this.db.insertRecord(STAFF_COLLECTION, record.id, record);
    this.db.changes.next(STAFF_COLLECTION);
    return record;
  }

  async delete(id: string): Promise<void> {
    const previous = await this.getById(id);
    if (!previous) throw new Error('This staff record no longer exists. Refresh the list.');
    await this.db.upsertRecord(STAFF_COLLECTION, id, { ...previous, active: false, updatedAt: new Date().toISOString() });
    this.db.changes.next(STAFF_COLLECTION);
  }

  private normalize(draft: StaffDraft): StaffDraft {
    const text = (value: unknown, label: string, max: number): string => {
      if (value != null && typeof value !== 'string') throw new Error('Enter a valid ' + label + '.');
      const result = String(value ?? '').trim().replace(/\s+/g, ' ');
      if (result.length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.');
      return result;
    };
    const name = text(draft.name, 'staff name', 120);
    if (!name) throw new Error('Enter the staff name.');
    const designation = text(draft.designation, 'designation', 120);
    const employmentType = draft.employmentType ?? '';
    if (!['', 'permanent', 'intern'].includes(employmentType)) throw new Error('Select Permanent or Intern.');
    if (typeof draft.active !== 'boolean') throw new Error('Select an active or inactive status.');
    if (!Array.isArray(draft.assignments)) throw new Error('Enter valid duty assignments.');
    const seen = new Set<string>();
    const assignments: StaffDutyAssignment[] = draft.assignments.map((assignment, index) => {
      if (!assignment || typeof assignment !== 'object') throw new Error('Enter a valid duty assignment.');
      const duty = text(assignment.duty, 'duty name', 120), shift = text(assignment.shift, 'shift name', 60);
      if (!duty) throw new Error('Enter the duty name for assignment ' + (index + 1) + '.');
      const startTime = text(assignment.startTime, 'start time', 5), endTime = text(assignment.endTime, 'end time', 5);
      const timing = dutyTimingError(startTime, endTime); if (timing) throw new Error(timing);
      const key = JSON.stringify([staffKey(duty), staffKey(shift), startTime, endTime]);
      if (seen.has(key)) throw new Error('Remove the repeated duty assignment.'); seen.add(key);
      return { duty, shift, startTime, endTime };
    });
    return { name, designation, employmentType, active: draft.active, assignments };
  }
}
