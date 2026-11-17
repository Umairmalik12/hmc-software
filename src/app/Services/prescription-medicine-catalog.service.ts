import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { COMMON_MEDICINES_ARRAY } from '../Components/precipion/prescription-medicines';
import { SupabaseDataService } from './supabase-data.service';

export interface PrescriptionMedicineOption { id: string; name: string; active: boolean; }
export const PRESCRIPTION_MEDICINE_CATALOG = 'prescriptionMedicineCatalog';
export const medicineKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();
export const DEFAULT_PRESCRIPTION_MEDICINES: readonly PrescriptionMedicineOption[] = Array.from(new Map(COMMON_MEDICINES_ARRAY.map(name => {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return [medicineKey(trimmed), { id: 'default:' + encodeURIComponent(medicineKey(trimmed)), name: trimmed, active: true }] as const;
})).values());

@Injectable({ providedIn: 'root' })
export class PrescriptionMedicineCatalogService implements OnDestroy {
  readonly changes = new Subject<void>();
  private cache?: Promise<PrescriptionMedicineOption[]>;
  private subscription: Subscription;
  constructor(private db: SupabaseDataService) {
    this.subscription = db.changes.subscribe(collection => {
      if (collection === PRESCRIPTION_MEDICINE_CATALOG || collection === 'customMedicines') this.invalidate();
    });
  }
  ngOnDestroy(): void { this.subscription.unsubscribe(); this.changes.complete(); }
  private invalidate(): void { this.cache = undefined; this.changes.next(); }

  async getAll(includeInactive = false, refresh = false): Promise<PrescriptionMedicineOption[]> {
    if (refresh) this.cache = undefined;
    const request = this.cache || (this.cache = this.read());
    try { return (await request).filter(option => includeInactive || option.active).map(option => ({ ...option })); }
    catch (error) { if (this.cache === request) this.cache = undefined; throw error; }
  }

  private async read(): Promise<PrescriptionMedicineOption[]> {
    const [stored, legacy] = await Promise.all([
      this.db.getItem<PrescriptionMedicineOption[]>(PRESCRIPTION_MEDICINE_CATALOG), this.db.getItem<string[]>('customMedicines'),
    ]);
    const options = new Map(DEFAULT_PRESCRIPTION_MEDICINES.map(option => [option.id, { ...option }]));
    const names = new Set(Array.from(options.values()).map(option => medicineKey(option.name)));
    if (Array.isArray(legacy)) legacy.filter((name): name is string => typeof name === 'string' && !!name.trim()).forEach(name => {
      const key = medicineKey(name);
      if (!names.has(key)) { options.set('legacy:' + encodeURIComponent(key), { id: 'legacy:' + encodeURIComponent(key), name: name.trim().replace(/\s+/g, ' '), active: true }); names.add(key); }
    });
    if (Array.isArray(stored)) stored.forEach(option => {
      if (option && typeof option.name === 'string' && option.name.trim() && option.id) options.set(String(option.id), { id: String(option.id), name: option.name, active: option.active !== false });
    });
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async save(name: string, id?: string): Promise<PrescriptionMedicineOption> {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new Error('Enter a medicine name.');
    if (trimmed.length > 160) throw new Error('Use 160 characters or fewer for the medicine name.');
    const all = await this.read();
    if (id && !all.some(option => option.id === id)) throw new Error('This medicine no longer exists. Refresh the list.');
    const duplicate = all.find(option => option.id !== id && medicineKey(option.name) === medicineKey(trimmed));
    if (duplicate?.active) throw new Error('This medicine already exists.');
    const option = { id: id || duplicate?.id || String(await this.db.allocateId(PRESCRIPTION_MEDICINE_CATALOG)), name: trimmed, active: true };
    await this.db.upsertRecord(PRESCRIPTION_MEDICINE_CATALOG, option.id, option);
    this.invalidate();
    return option;
  }

  async delete(option: PrescriptionMedicineOption): Promise<void> {
    // Tombstones keep removed built-in and legacy suggestions from reappearing.
    // Saved prescriptions retain the original name and dose text.
    await this.db.upsertRecord(PRESCRIPTION_MEDICINE_CATALOG, option.id, { ...option, active: false });
    this.invalidate();
  }
}
