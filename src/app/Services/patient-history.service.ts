import { Injectable } from '@angular/core';
import { PrescriptionRecord } from '../Models/prescription.model';
import { SupabaseDataService } from './supabase-data.service';

export interface PatientHistoryEntry {
  id: string;
  module: string;
  dateTime: string;
  doctor: string;
  summary: string;
  record: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class PatientHistoryService {
  constructor(private db: SupabaseDataService) {}

  async forMr(mr: number): Promise<PatientHistoryEntry[]> { return (await this.forPatients([mr])).get(mr) || []; }

  async forPatients(patientMrs: number[]): Promise<Map<number, PatientHistoryEntry[]>> {
    const knownMrs = new Set(patientMrs.filter(mr => Number.isSafeInteger(mr) && mr > 0));
    const histories = new Map<number, PatientHistoryEntry[]>(); knownMrs.forEach(mr => histories.set(mr, []));
    const [opd, ot, medicines, labs, inpatients, payments, prescriptions, legacyPrescription] = await Promise.all([
      this.db.getItem<any[]>('opdDetails'), this.db.getItem<any[]>('otFormData'),
      this.db.getItem<any[]>('medicineDetails'), this.db.getItem<any[]>('labDetails'),
      this.db.getItem<any[]>('inpatientDetails'), this.db.getItem<any[]>('payments'),
      this.db.getItem<PrescriptionRecord[]>('prescriptions'),
      this.db.getItem<PrescriptionRecord>('prescription'),
    ]);
    const entries: Array<{ mr: number; entry: PatientHistoryEntry }> = [];
    const add = (mr: number, module: string, id: unknown, value: any, dateTime: unknown, doctor: unknown, summary: unknown): void => {
      if (!knownMrs.has(mr)) return;
      entries.push({ mr, entry: { id: String(id ?? ''), module, dateTime: String(dateTime ?? ''), doctor: String(doctor ?? ''), summary: String(summary ?? ''), record: value } });
    };
    const visits = Array.isArray(opd) ? opd : [];
    visits.filter(record => knownMrs.has(Number(record.patientId))).forEach(record => add(Number(record.patientId), 'OPD visit', record.visitId || record.patientId, record,
      [record.date, record.time].filter(Boolean).join(' '), record.drName, record.procedure || record.history || 'Outpatient visit'));
    const visitMr = new Map(visits.map(record => [String(record.visitId || record.patientId), Number(record.patientId)]));
    const allPrescriptions = [...(Array.isArray(prescriptions) ? prescriptions : []), ...(legacyPrescription?.patient ? [legacyPrescription] : [])];
    allPrescriptions.forEach(record => {
      const mr = Number(record.patient?.refId) || visitMr.get(String(record.opdVisitId));
      if (mr) add(mr, 'Prescription', record.id, record, record.issuedAt, record.doctorName, record.medicines?.map(item => item.name).filter(Boolean).join(', ') || record.patient?.diagnosis || 'Prescription');
    });
    (Array.isArray(ot) ? ot : []).filter(record => knownMrs.has(Number(record.mrNumber))).forEach(record => add(Number(record.mrNumber), 'OT medicine', record.id, record,
      [record.operationDate, record.operationTime].filter(Boolean).join(' '), record.doctorName, record.procedure || 'OT medicine record'));
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
}
