import { Injectable } from '@angular/core';
import { PatientDetail } from '../Models/patientDetail.model';
import { SupabaseDataService } from './supabase-data.service';

/** Resolves a manually entered MR to the one patient master record. */
@Injectable({ providedIn: 'root' })
export class PatientLookupService {
  constructor(private db: SupabaseDataService) {}

  async byMr(value: unknown): Promise<PatientDetail | undefined> {
    const mr = Number(String(value ?? '').trim());
    if (!Number.isSafeInteger(mr) || mr < 1) return undefined;
    const patients = await this.db.getItem<PatientDetail[]>('patientDetails');
    return (patients || []).find(patient => patient.patientId === mr);
  }
}
