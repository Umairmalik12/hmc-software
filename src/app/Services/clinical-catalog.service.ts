import { Injectable } from '@angular/core';
import { SupabaseDataService } from './supabase-data.service';

export type ClinicalCatalogKind = 'doctors' | 'lab-tests';
export interface ClinicalOption { id: string; name: string; active: boolean; }
export const CLINICAL_COLLECTIONS: Record<ClinicalCatalogKind, string> = { doctors: 'doctorCatalog', 'lab-tests': 'labTestCatalog' };
export const DEFAULT_LAB_TESTS: ClinicalOption[] = ['RPM', 'H/B', 'CUE', 'RBS', 'CBC', 'S/E', 'Uric Acid', 'Anti-HCV', 'HBS AG', 'PSA', 'Blood Group', 'Cross Match', 'LFTs', 'Lipo-Profile', 'X-ray']
  .map((name, index) => ({ id: 'default-' + (index + 1), name, active: true }));
export const clinicalNameKey = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const sameClinicalName = (left: unknown, right: unknown): boolean => clinicalNameKey(left) === clinicalNameKey(right);
export const labTestNames = (value: unknown): string[] => (Array.isArray(value) ? value : String(value ?? '').split(','))
  .map(name => String(name).trim()).filter(Boolean);

@Injectable({ providedIn: 'root' })
export class ClinicalCatalogService {
  readonly changes = this.db.changes;
  constructor(private db: SupabaseDataService) {}

  async getAll(kind: ClinicalCatalogKind, includeInactive = false): Promise<ClinicalOption[]> {
    const stored = await this.db.getItem<ClinicalOption[]>(CLINICAL_COLLECTIONS[kind]);
    const options = new Map((kind === 'lab-tests' ? DEFAULT_LAB_TESTS : []).map(option => [option.id, { ...option }]));
    (stored || []).forEach(option => options.set(option.id, { ...option, active: option.active !== false }));
    return [...options.values()].filter(option => includeInactive || option.active).sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(kind: ClinicalCatalogKind, name: string, id?: string, active = true): Promise<ClinicalOption> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const label = kind === 'doctors' ? 'doctor / surgeon' : 'lab test';
    if (!normalized) throw new Error('Enter a ' + label + ' name.');
    if (normalized.length > 120) throw new Error('Names must be 120 characters or fewer.');
    if (kind === 'lab-tests' && normalized.includes(',')) throw new Error('Enter one lab test name without commas.');
    const all = await this.getAll(kind, true);
    if (id && !all.some(option => option.id === id)) throw new Error('This catalogue record no longer exists. Refresh the list.');
    const duplicate = all.find(option => option.id !== id && sameClinicalName(option.name, normalized));
    if (duplicate && (duplicate.active || id)) throw new Error('This ' + label + ' already exists.');
    const collection = CLINICAL_COLLECTIONS[kind];
    const option = { id: id || duplicate?.id || String(await this.db.allocateId(collection)), name: normalized, active };
    await this.db.upsertRecord(collection, option.id, option);
    this.db.changes.next(collection);
    return option;
  }

  async delete(kind: ClinicalCatalogKind, option: ClinicalOption): Promise<void> {
    const current = (await this.getAll(kind, true)).find(item => item.id === option.id);
    if (!current) throw new Error('This catalogue record no longer exists. Refresh the list.');
    await this.db.upsertRecord(CLINICAL_COLLECTIONS[kind], option.id, { ...current, active: false });
    this.db.changes.next(CLINICAL_COLLECTIONS[kind]);
  }
}
