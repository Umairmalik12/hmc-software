import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { OT_MEDICINES } from '../Components/otslip/ot-medicines';
import { emptyOtCatalogMedicine, OtCatalogMedicine, otMedicineKey } from '../Models/ot-medicine-catalog.model';
import { SupabaseDataService } from './supabase-data.service';

export const OT_MEDICINE_CATALOG = 'otMedicineCatalog';
export const DEFAULT_OT_CATALOG: readonly OtCatalogMedicine[] = OT_MEDICINES.map(name => ({
  ...emptyOtCatalogMedicine(), id: 'default:' + encodeURIComponent(otMedicineKey(name)), name: name.trim(),
  type: name.startsWith('INJ.') ? 'Injection' : '',
}));

@Injectable({ providedIn: 'root' })
export class OtMedicineCatalogService implements OnDestroy {
  readonly changes = new Subject<void>();
  private cache?: Promise<OtCatalogMedicine[]>;
  private subscription: Subscription;
  constructor(private db: SupabaseDataService) {
    this.subscription = db.changes.subscribe(collection => { if (collection === OT_MEDICINE_CATALOG) this.invalidate(); });
  }
  ngOnDestroy(): void { this.subscription.unsubscribe(); this.changes.complete(); }
  private invalidate(): void { this.cache = undefined; this.changes.next(); }

  async getAll(includeDeleted = false, refresh = false): Promise<OtCatalogMedicine[]> {
    if (refresh) this.cache = undefined;
    const request = this.cache || (this.cache = this.read());
    try { return (await request).filter(item => includeDeleted || !item.deleted).map(item => ({ ...item })); }
    catch (error) { if (this.cache === request) this.cache = undefined; throw error; }
  }
  async getById(id: string, refresh = false): Promise<OtCatalogMedicine | undefined> { return (await this.getAll(false, refresh)).find(item => item.id === id); }

  private async read(): Promise<OtCatalogMedicine[]> {
    const stored = await this.db.getItem<OtCatalogMedicine[]>(OT_MEDICINE_CATALOG);
    const rows = new Map(DEFAULT_OT_CATALOG.map(item => [item.id, { ...item }]));
    if (Array.isArray(stored)) stored.forEach(item => {
      if (item?.id && typeof item.name === 'string') rows.set(String(item.id), { ...emptyOtCatalogMedicine(), ...item, id: String(item.id), active: item.active !== false, deleted: item.deleted === true });
    });
    return Array.from(rows.values());
  }

  async save(draft: OtCatalogMedicine): Promise<OtCatalogMedicine> {
    const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
    const name = text(draft.name).replace(/\s+/g, ' ');
    if (!name) throw new Error('Enter the medicine name.');
    const limits: Array<[string, unknown, number]> = [['Medicine name', name, 160], ['Generic name', draft.genericName, 160], ['Category', draft.category, 80], ['Medicine type', draft.type, 60], ['Strength', draft.strength, 80], ['Unit', draft.unit, 40], ['Description', draft.description, 1500]];
    for (const [label, value, max] of limits) if (text(value).length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.');
    if (typeof draft.active !== 'boolean') throw new Error('Choose Active or Inactive status.');
    const all = await this.read();
    const existing = draft.id ? all.find(item => item.id === draft.id) : undefined;
    if (draft.id && (!existing || existing.deleted)) throw new Error('This OT medicine has been removed. Refresh the medicine list.');
    const duplicate = all.find(item => item.id !== draft.id && otMedicineKey(item.name) === otMedicineKey(name));
    if (duplicate && !duplicate.deleted) throw new Error('An OT medicine with this name already exists. Edit or reactivate that entry.');
    const now = new Date().toISOString();
    const record: OtCatalogMedicine = { ...emptyOtCatalogMedicine(), ...(existing || duplicate), id: draft.id || duplicate?.id || String(await this.db.allocateId(OT_MEDICINE_CATALOG)), name,
      genericName: text(draft.genericName), category: text(draft.category), type: text(draft.type), strength: text(draft.strength), unit: text(draft.unit), description: text(draft.description),
      active: draft.active, deleted: false, createdAt: existing?.createdAt || duplicate?.createdAt || now, updatedAt: now };
    await this.db.upsertRecord(OT_MEDICINE_CATALOG, record.id, record);
    this.invalidate(); return record;
  }

  async delete(id: string): Promise<void> {
    const current = (await this.read()).find(item => item.id === id);
    if (!current || current.deleted) throw new Error('This OT medicine is no longer available. Refresh the list.');
    await this.db.upsertRecord(OT_MEDICINE_CATALOG, id, { ...current, active: false, deleted: true, updatedAt: new Date().toISOString() });
    this.invalidate();
  }
}
