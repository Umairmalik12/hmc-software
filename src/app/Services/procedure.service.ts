import { Injectable } from '@angular/core';
import { SupabaseDataService } from './supabase-data.service';

export interface ProcedureOption { id: string; name: string; active: boolean; }

export const DEFAULT_PROCEDURES: ProcedureOption[] = [
  'Left nephrectomy', 'Right nephrectomy', 'Right pyelolithotomy', 'Left pyelolithotomy',
  'IOU', 'Cystoscopy', 'Cystolithotomy', 'Cystolitholopaxy',
  'Right URS L/C + DJS', 'Left URS L/C + DJS', 'B/L URS L/C + DJS',
  'Right ureterolithotomy', 'Left ureterolithotomy', 'Pyeloplasty (right or left)',
].map((name, index) => ({ id: 'default-' + (index + 1), name, active: true }));

@Injectable({ providedIn: 'root' })
export class ProcedureService {
  constructor(private db: SupabaseDataService) {}

  async getAll(includeInactive = false): Promise<ProcedureOption[]> {
    const stored = await this.db.getItem<ProcedureOption[]>('procedures');
    const options = new Map(DEFAULT_PROCEDURES.map(option => [option.id, { ...option }]));
    if (Array.isArray(stored)) stored.forEach(option => options.set(option.id, { ...option, active: option.active !== false }));
    return Array.from(options.values()).filter(option => includeInactive || option.active);
  }

  async save(name: string, id?: string): Promise<ProcedureOption> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Enter a procedure name.');
    if (trimmed.length > 120) throw new Error('Procedure names must be 120 characters or fewer.');
    const all = await this.getAll(true);
    const duplicate = all.find(option => option.id !== id && option.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (duplicate?.active) throw new Error('This procedure already exists.');
    const option = { id: id || duplicate?.id || String(await this.db.allocateId('procedures')), name: trimmed, active: true };
    await this.db.upsertRecord('procedures', option.id, option);
    return option;
  }

  async delete(option: ProcedureOption): Promise<void> {
    // Persist a tombstone so a deleted built-in procedure does not reappear.
    // Existing patient/OT records keep their original procedure text.
    await this.db.upsertRecord('procedures', option.id, { ...option, active: false });
  }
}
