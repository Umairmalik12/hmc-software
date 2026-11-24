import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { COMMON_MEDICINES_ARRAY } from '../Components/precipion/prescription-medicines';
import { SupabaseDataService } from './supabase-data.service';
import { medicineNameWithStrength, medicineVariantKey, normalizeMedicineStrength } from '../Models/medicine-strength';

export interface PrescriptionMedicineOption { id: string; name: string; active: boolean; strength?: string; }
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
  async canManage(): Promise<boolean> {
    for (const action of ['create', 'edit', 'delete'] as const) { try { await this.db.requirePermission('medicine-catalog', action); return true; } catch { /* Check the next catalogue action. */ } }
    return false;
  }

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
      if (option && typeof option.name === 'string' && option.name.trim() && option.id) {
        const strength = typeof option.strength === 'string' ? normalizeMedicineStrength(option.strength) : '';
        options.set(String(option.id), { ...option, id: String(option.id), name: strength ? medicineNameWithStrength(option.name, strength) : option.name, active: option.active !== false, ...(typeof option.strength === 'string' ? { strength } : { strength: undefined }) });
      }
    });
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async save(name: string, id?: string, strength?: string): Promise<PrescriptionMedicineOption> {
    await this.db.requirePermission('medicine-catalog', id ? 'edit' : 'create', id ? 'You do not have permission to edit catalogue medicines.' : 'You do not have permission to add catalogue medicines.');
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) throw new Error('Enter a medicine name.');
    if (trimmed.length > 160) throw new Error('Use 160 characters or fewer for the medicine name.');
    if (strength !== undefined && (typeof strength !== 'string' || strength.trim().length > 60)) throw new Error('Use 60 characters or fewer for the medicine strength.');
    const all = await this.read();
    if (id && !all.some(option => option.id === id)) throw new Error('This medicine no longer exists. Refresh the list.');
    const existing = id ? all.find(option => option.id === id) : undefined;
    const selectedStrength = strength === undefined ? existing?.strength : normalizeMedicineStrength(strength);
    const displayName = medicineNameWithStrength(trimmed, selectedStrength || '');
    if (displayName.length > 160) throw new Error('Use 160 characters or fewer for the medicine name and strength together.');
    const matches = all.filter(option => option.id !== id && medicineVariantKey(option.name, option.strength) === medicineVariantKey(displayName, selectedStrength));
    const duplicate = matches.find(option => option.active) || matches[0];
    if (duplicate?.active) throw new Error('This medicine already exists.');
    if (!id && duplicate) await this.db.requirePermission('medicine-catalog', 'edit', 'You do not have permission to restore catalogue medicines.');
    const option: PrescriptionMedicineOption = { ...(existing || duplicate), id: id || duplicate?.id || String(await this.db.allocateId(PRESCRIPTION_MEDICINE_CATALOG)), name: displayName, active: true, ...(selectedStrength !== undefined ? { strength: selectedStrength } : {}) };
    await this.db.upsertRecord(PRESCRIPTION_MEDICINE_CATALOG, option.id, option);
    this.invalidate();
    return option;
  }

  async delete(option: PrescriptionMedicineOption): Promise<void> {
    await this.db.requirePermission('medicine-catalog', 'delete', 'You do not have permission to delete catalogue medicines.');
    // Tombstones keep removed built-in and legacy suggestions from reappearing.
    // Saved prescriptions retain the original name and dose text.
    await this.db.upsertRecord(PRESCRIPTION_MEDICINE_CATALOG, option.id, { ...option, active: false });
    this.invalidate();
  }
}
