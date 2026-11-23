import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LabPatient } from '../Models/lab.model';
import { SupabaseDataService } from './supabase-data.service';

@Injectable({
  providedIn: 'root'
})
export class LabService {
  total: number = 0;
  labDetail: LabPatient[] = [];

  constructor(private indexedDbService: SupabaseDataService) {
  }

  private loadLabData(): void {
    this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
      this.labDetail = data ?? [];
    });
  }

  private saveLabData(): Promise<void> {
    return this.indexedDbService.setItem('labDetails', this.labDetail);
  }

  private sortNewestFirst(items: LabPatient[]): LabPatient[] {
    return [...items].sort((a, b) => {
      const timeA = (a as any).createdAt || a.dateTime ? new Date(((a as any).createdAt || a.dateTime)).getTime() : 0;
      const timeB = (b as any).createdAt || b.dateTime ? new Date(((b as any).createdAt || b.dateTime)).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return String(b.labId || b.patientId || '').localeCompare(String(a.labId || a.patientId || ''), undefined, { numeric: true });
    });
  }

  getAllLabPatient(): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = this.sortNewestFirst(data ?? []);
        this.total = this.labDetail.length;
        observer.next(this.labDetail);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  findLabPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = this.sortNewestFirst(data ?? []);
        this.total = this.labDetail.length;

        let start = pageNumber * pageSize;
        let end = Math.min(start + pageSize, this.labDetail.length);
        let paginated = this.labDetail.slice(start, end);

        observer.next(paginated);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  getLabPatientDetails(id: number | string): Observable<LabPatient | undefined> {
    return new Observable<LabPatient | undefined>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = data ?? [];
        const patient = this.labDetail.find(o => String(o.labId || '') === String(id)) || this.labDetail.find(o => o.patientId === Number(id));
        observer.next(patient);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  async addNewLabPatient(data: LabPatient): Promise<boolean> {
    try {
      const stored = await this.indexedDbService.getItem<LabPatient[]>('labDetails');
      this.labDetail = stored ?? [];
      if (data.mrNumber !== undefined && (!Number.isSafeInteger(data.mrNumber) || data.mrNumber < 1)) return false;
      const labId = data.labId || String(await this.indexedDbService.allocateId('labDetails'));
      const saved = { ...data, labId, patientId: data.mrNumber ?? data.patientId };
      await this.indexedDbService.insertRecord('labDetails', labId, saved);
      this.labDetail.push(saved);
      return true;
    } catch (err) {
      console.error('Error adding lab patient:', err);
      return false;
    }
  }

  async updateLabPatient(data: LabPatient): Promise<boolean> {
    try {
      const stored = await this.indexedDbService.getItem<LabPatient[]>('labDetails');
      this.labDetail = stored ?? [];

      const index = this.labDetail.findIndex(o => data.labId ? String(o.labId) === String(data.labId) : o.patientId === data.patientId);
      if (index !== -1) {
        const updated = { ...data, labId: this.labDetail[index].labId || String(this.labDetail[index].patientId) };
        await this.indexedDbService.upsertRecord('labDetails', updated.labId!, updated, index);
        this.labDetail[index] = updated;
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating lab patient:', err);
      return false;
    }
  }

  getLabPatientBrief(): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        const list: LabPatient[] = (data ?? []).map(p => ({
          patientId: p.mrNumber ?? p.patientId,
          mrNumber: p.mrNumber,
          labId: p.labId,
          name: p.name,
          phone: p.phone,
          testName: p.testName,
          price: p.price,
          suggestedDr: p.suggestedDr,
          dateTime: p.dateTime
        }));
        this.labDetail = list;
        observer.next(list);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  async deleteLabPatient(id: number | string): Promise<boolean> {
    try {
      const data = await this.indexedDbService.getItem<LabPatient[]>('labDetails');
      this.labDetail = data ?? [];

      let index = this.labDetail.findIndex(p => String(p.labId || '') === String(id));
      if (index < 0) index = this.labDetail.findIndex(p => p.patientId === Number(id));
      if (index !== -1) {
        await this.indexedDbService.deleteRecord('labDetails', this.labDetail[index].labId || id);
        this.labDetail.splice(index, 1);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting lab patient:', err);
      return false;
    }
  }

}
