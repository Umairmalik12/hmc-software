import { Injectable } from '@angular/core';
import { PrescriptionRecord, copyPrescription, emptyPrescription } from '../Models/prescription.model';
import { SupabaseDataService } from './supabase-data.service';
import { selectedDateTime } from '../Shared/date-time-values';

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
    if (legacy && !Array.isArray(legacy) && legacy.patient) {
      records.push(this.normalize({ ...legacy, id: this.legacyId(records) }));
    }
    return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id));
  }

  async getById(id: string): Promise<PrescriptionRecord | undefined> {
    return (await this.getAll()).find(record => record.id === id);
  }

  async getByOpdVisitId(visitId: string): Promise<PrescriptionRecord | undefined> {
    if (!visitId) return undefined;
    return (await this.getAll()).find(record => record.opdVisitId === visitId);
  }

  async save(draft: PrescriptionRecord): Promise<PrescriptionRecord> {
    if (!draft.patient.name.trim()) throw new Error('Enter the patient name before saving.');
    const issuedAt = selectedDateTime(draft.issuedAt);
    const existingForVisit = draft.opdVisitId ? await this.getByOpdVisitId(draft.opdVisitId) : undefined;
    if (existingForVisit && draft.id && existingForVisit.id !== draft.id) {
      throw new Error('This OPD visit already has a linked prescription. Refresh and open that prescription.');
    }
    // A retry or second editor for the same visit updates its one linked record instead of creating a duplicate.
    const effectiveId = draft.id || existingForVisit?.id || '';
    await this.db.requirePermission('prescriptions', effectiveId ? 'edit' : 'create', effectiveId ? 'You do not have permission to edit prescriptions.' : 'You do not have permission to create prescriptions.');
    const target = effectiveId ? await this.storageTarget(effectiveId) : undefined;
    const now = new Date().toISOString(); // Audit metadata only.
    const record = copyPrescription(draft);
    record.id = effectiveId || this.pendingIds.get(draft) || String(await this.db.allocateId(PRESCRIPTIONS_COLLECTION));
    this.pendingIds.set(draft, record.id);
    record.patient.name = record.patient.name.trim();
    record.issuedAt = issuedAt;
    record.createdAt = draft.createdAt || now;
    record.updatedAt = now;
    record.status = draft.status === 'draft' ? 'draft' : 'completed';
    if (target?.collection === 'prescription') {
      await this.db.setItem('prescription', record);
    } else {
      // Write only this record so another workstation's prescriptions survive.
      await this.db.upsertRecord(PRESCRIPTIONS_COLLECTION, record.id, record);
    }
    return record;
  }

  async delete(id: string): Promise<void> {
    if (!id) throw new Error('Prescription ID is missing.');
    const target = await this.storageTarget(id);
    await this.db.deletePrescriptionRecord(target.collection, target.id);
  }

  private legacyId(stored: PrescriptionRecord[]): string {
    let id = LEGACY_ID;
    while (stored.some(record => String(record.id) === id)) id += ':singleton';
    return id;
  }

  private async storageTarget(id: string): Promise<{ collection: 'prescriptions' | 'prescription'; id: string }> {
    const stored = await this.db.getItem<PrescriptionRecord[]>(PRESCRIPTIONS_COLLECTION);
    const records = Array.isArray(stored) ? stored : [];
    if (records.some(record => String(record.id) === id)) return { collection: 'prescriptions', id };
    if (id === this.legacyId(records)) {
      const legacy = await this.db.getItem<Partial<PrescriptionRecord>>('prescription');
      if (legacy && !Array.isArray(legacy) && legacy.patient) return { collection: 'prescription', id: '__singleton__' };
    }
    throw new Error('This prescription no longer exists. Refresh the prescription list.');
  }

  private normalize(value: Partial<PrescriptionRecord>): PrescriptionRecord {
    const empty = emptyPrescription();
    return {
      ...empty, ...value, id: String(value.id ?? ''),
      status: value.status === 'draft' ? 'draft' : 'completed',
      patient: { ...empty.patient, ...value.patient },
      medicines: Array.isArray(value.medicines) && value.medicines.length
        ? value.medicines.map(medicine => ({ name: String(medicine.name || ''), morning: medicine.morning === true,
            afternoon: medicine.afternoon === true, evening: medicine.evening === true }))
        : empty.medicines,
      // Do not invent an issue date for the older undated singleton.
      issuedAt: value.issuedAt ?? value.createdAt ?? '',
      createdAt: value.createdAt || '', updatedAt: value.updatedAt || '',
    };
  }
}
