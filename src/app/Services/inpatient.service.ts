import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { InPatient } from '../Models/inpatient.model';
import { SupabaseDataService } from './supabase-data.service';

const STORAGE_KEY = 'inpatientDetails';

export interface InPatientDetail {
  inpatientId: number;
  mrNumber?: number;
  patientName: string;
  procedure: string;
  admissionDate: string;
  dischargeDate: string;
  surgeonName: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class InpatientService {
  total: number = 0;
  inpatientDetail: InPatientDetail[] = [];

  constructor(private indexedDb: SupabaseDataService) {
  }

  private async loadInpatientData(): Promise<void> {
    const storedInpatients = await this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY);
    this.inpatientDetail = storedInpatients || [];
  }

  private async saveInpatientData(): Promise<void> {
    await this.indexedDb.setItem(STORAGE_KEY, this.inpatientDetail);
  }

  private sortNewestFirst(items: InPatientDetail[]): InPatientDetail[] {
    return [...items].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (Number(b.inpatientId) || 0) - (Number(a.inpatientId) || 0);
    });
  }

  getAllInpatient(): Observable<InPatient[]> {
    return new Observable<InPatient[]>(observer => {
      this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY).then(data => {
        const inpatients = this.sortNewestFirst(data || []);
        this.inpatientDetail = inpatients;
        this.total = inpatients.length;
        observer.next(this.getInpatientBrief(inpatients));
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  findInpatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<InPatient[]> {
    return new Observable<InPatient[]>(observer => {
      this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY).then(data => {
        const inpatients = this.sortNewestFirst(data || []);
        this.inpatientDetail = inpatients;
        this.total = inpatients.length;

        const all = this.getInpatientBrief(inpatients);
        const start = pageNumber * pageSize;
        const end = Math.min(start + pageSize, all.length);
        observer.next(all.slice(start, end));
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  getInpatientDetails(id: number): Observable<InPatientDetail | undefined> {
    return new Observable<InPatientDetail>(observer => {
      this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY).then(data => {
        const inpatient: any = (data || []).find(p => p.inpatientId === id);
        observer.next(inpatient);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  async addNewInpatient(data: InPatientDetail): Promise<boolean> {
    try {
      if (!this.validPatientId(data.inpatientId)) return false;
      const storedInpatients = await this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY) || [];
      if (storedInpatients.some(patient => patient.inpatientId === data.inpatientId)) return false;


      await this.indexedDb.insertRecord(STORAGE_KEY, data.inpatientId, data);
      storedInpatients.push(data);
      this.inpatientDetail = storedInpatients;
      return true;
    } catch (e) {
      console.error('Error adding new inpatient:', e);
      return false;
    }
  }

  async updateInpatient(data: InPatientDetail): Promise<boolean> {
    try {
      if (!this.validPatientId(data.inpatientId)) return false;
      const storedInpatients = await this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY) || [];
      const index = storedInpatients.findIndex(p => p.inpatientId === data.inpatientId);
      if (index !== -1) {
        await this.indexedDb.upsertRecord(STORAGE_KEY, data.inpatientId, data, index);
        storedInpatients[index] = data;
        this.inpatientDetail = storedInpatients;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating inpatient:', e);
      return false;
    }
  }

  private validPatientId(value: number): boolean {
    return Number.isSafeInteger(value) && value > 0;
  }

  private getInpatientBrief(inpatients: InPatientDetail[]): InPatient[] {
    return inpatients.map(p => ({
      inpatientId: p.inpatientId,
      mrNumber: p.mrNumber,
      patientName: p.patientName,
      procedure: p.procedure,
      admissionDate: p.admissionDate,
      dischargeDate: p.dischargeDate,
      surgeonName: p.surgeonName,
      createdAt: p.createdAt
    }));

  }

  async deleteInpatient(id: number): Promise<boolean> {
    try {
      const storedInpatients = await this.indexedDb.getItem<InPatientDetail[]>(STORAGE_KEY) || [];
      if (!storedInpatients.some(p => p.inpatientId === id)) {
        return false;
      }

      await this.indexedDb.deleteRecord(STORAGE_KEY, id);
      const updatedInpatients = storedInpatients.filter(p => p.inpatientId !== id);
      this.inpatientDetail = updatedInpatients;
      return true;
    } catch (e) {
      console.error('Error deleting inpatient:', e);
      return false;
    }
  }
}
