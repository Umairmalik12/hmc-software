import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { PrescriptionRecord } from '../Models/prescription.model';
import { SupabaseDataService } from './supabase-data.service';
import { clockValue } from '../Shared/date-time-values';

export interface PatientHistoryEntry {
  id: string;
  module: string;
  dateTime: string;
  doctor: string;
  summary: string;
  record: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class PatientHistoryService implements OnDestroy {
  private snapshot?: Promise<any[]>;
  private cacheUntil = 0;
  private changes: Subscription;
  constructor(private db: SupabaseDataService) {
    this.changes = db.changes.subscribe(() => { this.snapshot = undefined; });
  }
  ngOnDestroy(): void { this.changes.unsubscribe(); }
  invalidate(): void { this.snapshot = undefined; }
  private readRecords(): Promise<any[]> {
    if (!this.snapshot || Date.now() > this.cacheUntil) {
      this.cacheUntil = Date.now() + 5000;
      const request = Promise.all([
        this.db.getItem<any[]>('opdDetails'), this.db.getItem<any[]>('otFormData'),
        this.db.getItem<any[]>('medicineDetails'), this.db.getItem<any[]>('labDetails'),
        this.db.getItem<any[]>('inpatientDetails'), this.db.getItem<any[]>('payments'),
        this.db.getItem<PrescriptionRecord[]>('prescriptions'), this.db.getItem<PrescriptionRecord>('prescription'),
        this.db.getItem<any[]>('patientDetails'),
      ]);
      this.snapshot = request;
      void request.catch(() => { if (this.snapshot === request) this.snapshot = undefined; });
    }
    return this.snapshot;
  }

  async forMr(mr: number): Promise<PatientHistoryEntry[]> { return (await this.forPatients([mr])).get(mr) || []; }

  async forPatients(patientMrs: number[]): Promise<Map<number, PatientHistoryEntry[]>> {
    const knownMrs = new Set(patientMrs.filter(mr => Number.isSafeInteger(mr) && mr > 0));
    const histories = new Map<number, PatientHistoryEntry[]>(); knownMrs.forEach(mr => histories.set(mr, []));
    if (!knownMrs.size) return histories;
    const [opd, ot, medicines, labs, inpatients, payments, prescriptions, legacyPrescription, operations] = await this.readRecords();
    const entries: Array<{ mr: number; entry: PatientHistoryEntry }> = [];
    const add = (mr: number, module: string, id: unknown, value: any, dateTime: unknown, doctor: unknown, summary: unknown): void => {
      if (!knownMrs.has(mr)) return;
      entries.push({ mr, entry: { id: String(id ?? ''), module, dateTime: String(dateTime ?? ''), doctor: String(doctor ?? ''), summary: String(summary ?? ''), record: value } });
    };
    const visits = Array.isArray(opd) ? opd : [];
    (Array.isArray(operations) ? operations : []).forEach(record => add(Number(record.patientId), 'Operation patient', record.patientId, record,
      record.createdAt, record.drName, record.procedure || 'Operation registration'));
    visits.filter(record => knownMrs.has(Number(record.patientId))).forEach(record => add(Number(record.patientId), 'OPD visit', record.visitId || record.patientId, record,
      this.visitDate(record.date,record.time,record.createdAt), record.drName,
      'Visit ' + String(record.visitNumber || 1) + ' · ' + (record.procedure || record.history || 'Outpatient visit')));
    const visitMr = new Map<string,number>(visits.map(record => [String(record.visitId || record.patientId), Number(record.patientId)] as [string,number]));
    const allPrescriptions = [...(Array.isArray(prescriptions) ? prescriptions : []), ...(legacyPrescription?.patient ? [legacyPrescription] : [])];
    allPrescriptions.forEach(record => {
      const mr = visitMr.get(String(record.opdVisitId)) || Number(record.patient?.refId);
      if (mr) add(mr, 'Prescription', record.id || 'legacy-prescription', record, record.issuedAt, record.doctorName, record.medicines?.map((item: any) => item.name).filter(Boolean).join(', ') || record.patient?.diagnosis || 'Prescription');
    });
    (Array.isArray(ot) ? ot : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'OT medicine', record.id, record,
      this.visitDate(record.operationDate,record.operationTime,record.createdAt), record.doctorName, record.procedure || 'OT medicine record'));
    (Array.isArray(medicines) ? medicines : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'Daily medicine', record.medicineId, record,
      record.createdAt, record.doctorName, (record.medicines || []).map((item: any) => item.medicineName).filter(Boolean).join(', ') || 'Daily medicine record'));
    (Array.isArray(labs) ? labs : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'Laboratory', record.labId || record.patientId, record,
      record.dateTime, record.suggestedDr, record.testName || 'Laboratory tests'));
    (Array.isArray(inpatients) ? inpatients : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'Inpatient admission', record.inpatientId, record,
      record.admissionDate || record.createdAt, record.surgeonName, record.procedure || 'Admission'));
    (Array.isArray(payments) ? payments : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'Payment', record.id, record,
      record.createdAt, record.staffName, 'PKR ' + record.amount));
    entries.forEach(item => histories.get(item.mr)!.push(item.entry));
    histories.forEach(items => items.sort((a, b) => (Date.parse(b.dateTime) || 0) - (Date.parse(a.dateTime) || 0) || b.id.localeCompare(a.id)));
    return histories;
  }
  private visitDate(day: unknown, time: unknown, fallback: unknown): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return String(day) + 'T' + (clockValue(time) || '00:00');
    return String(day || fallback || '');
  }
}
