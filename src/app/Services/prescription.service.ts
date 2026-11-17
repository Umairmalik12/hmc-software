import { Injectable } from '@angular/core';
import { PrescriptionRecord, copyPrescription, emptyPrescription } from '../Models/prescription.model';
import { SupabaseDataService } from './supabase-data.service';

export const PRESCRIPTIONS_COLLECTION = 'prescriptions';
const LEGACY_ID = 'legacy-prescription';

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private pendingIds = new WeakMap<PrescriptionRecord, string>();
  constructor(private db: SupabaseDataService) {}

  async getAll(): Promise<PrescriptionRecord[]> {
    const [stored, legacy] = await Promise.all([
      this.db.getItem<PrescriptionRecord[]>(PRESCRIPTIONS_COLLECTION),
      this.db.getItem<Partial<PrescriptionRecord>>('prescription'),
    ]);
    const records = (Array.isArray(stored) ? stored : []).map(record => this.normalize(record));
    // The former editor stored one singleton. Keep it accessible in place,
    // without rewriting or deleting a medical record merely by opening a list.
    if (legacy && !Array.isArray(legacy) && legacy.patient && !records.some(record => record.id === LEGACY_ID)) {
      records.push(this.normalize({ ...legacy, id: LEGACY_ID }));
    }
    return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id));
  }

  async getById(id: string): Promise<PrescriptionRecord | undefined> {
    return (await this.getAll()).find(record => record.id === id);
  }

  async save(draft: PrescriptionRecord): Promise<PrescriptionRecord> {
    if (!draft.patient.name.trim()) throw new Error('Enter the patient name before saving.');
    const now = new Date().toISOString(); // Workstation clock; no fixed timezone.
    const record = copyPrescription(draft);
    record.id = record.id || this.pendingIds.get(draft) || String(await this.db.allocateId(PRESCRIPTIONS_COLLECTION));
    this.pendingIds.set(draft, record.id);
    record.patient.name = record.patient.name.trim();
    record.issuedAt = record.id === draft.id && draft.issuedAt ? draft.issuedAt : now;
    record.createdAt = draft.createdAt || now;
    record.updatedAt = now;
    if (record.id === LEGACY_ID) {
      await this.db.setItem('prescription', record);
    } else {
      // Write only this record so another workstation's prescriptions survive.
      await this.db.upsertRecord(PRESCRIPTIONS_COLLECTION, record.id, record);
    }
    return record;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Prescription ID is missing.');
    if (id === LEGACY_ID) await this.db.deleteRecord('prescription', '__singleton__');
    else await this.db.deleteRecord(PRESCRIPTIONS_COLLECTION, id);
  }

  private normalize(value: Partial<PrescriptionRecord>): PrescriptionRecord {
    const empty = emptyPrescription();
    return {
      ...empty, ...value, id: String(value.id || ''),
      patient: { ...empty.patient, ...value.patient },
      medicines: Array.isArray(value.medicines) && value.medicines.length
        ? value.medicines.map(medicine => ({ name: String(medicine.name || ''), morning: medicine.morning === true,
            afternoon: medicine.afternoon === true, evening: medicine.evening === true }))
        : empty.medicines,
      // Do not invent an issue date for the older undated singleton.
      issuedAt: value.issuedAt || value.createdAt || '',
      createdAt: value.createdAt || '', updatedAt: value.updatedAt || '',
    };
  }
}
