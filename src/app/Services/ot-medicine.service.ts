import { Injectable } from '@angular/core';
import { OtMedicineRecord, copyOtRecord, emptyOtRecord } from '../Models/ot-medicine.model';
import { SupabaseDataService } from './supabase-data.service';

@Injectable({ providedIn: 'root' })
export class OtMedicineService {
  private pendingIds = new WeakMap<OtMedicineRecord, string>();
  constructor(private db: SupabaseDataService) {}

  async getAll(): Promise<OtMedicineRecord[]> {
    const stored = await this.db.getItem<OtMedicineRecord[]>('otFormData');
    return (Array.isArray(stored) ? stored : []).map(record => ({ ...emptyOtRecord(), ...record, id: String(record.id),
      products: (Array.isArray(record.products) ? record.products : []).filter(product => product.selected !== false).map(product => ({ ...product, quantity: Number(product.quantity) })) }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id));
  }

  async getById(id: string): Promise<OtMedicineRecord | undefined> { return (await this.getAll()).find(record => record.id === id); }

  async save(draft: OtMedicineRecord): Promise<OtMedicineRecord> {
    if (!draft.patientName.trim()) throw new Error('Enter the patient name.');
    if (!draft.products.length) throw new Error('Select at least one medicine or supply.');
    if (draft.products.some(product => !product.name.trim() || !Number.isFinite(product.quantity) || product.quantity <= 0)) throw new Error('Enter a positive quantity for every selected item.');
    const record = copyOtRecord(draft);
    record.id = record.id || this.pendingIds.get(draft) || String(await this.db.allocateId('otFormData'));
    this.pendingIds.set(draft, record.id);
    const now = new Date().toISOString();
    record.patientName = record.patientName.trim();
    record.createdAt = record.createdAt || now;
    record.updatedAt = now;
    await this.db.upsertRecord('otFormData', record.id, record);
    return record;
  }

  async delete(id: string): Promise<void> { await this.db.deleteRecord('otFormData', id); }
}
