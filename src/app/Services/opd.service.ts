import { Injectable } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { Opd } from '../Models/opd.model';
import { SupabaseDataService } from './supabase-data.service';

@Injectable({
  providedIn: 'root'
})
export class OpdService {
  total: number = 0;
  opdDetail: Opd[] = [];

  constructor(private dbService: SupabaseDataService) {}

  private sortNewestFirst(items: Opd[]): Opd[] {
    return [...items].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (Number(b.patientId) || 0) - (Number(a.patientId) || 0);
    });
  }

  private async loadOpdData(): Promise<void> {
    const storedOpd = await this.dbService.getItem<Opd[]>('opdDetails');
    this.opdDetail = this.sortNewestFirst(storedOpd ?? []);
  }

  private async savePatientOpdData(): Promise<void> {
    console.log("this.opdDetail", this.opdDetail);
    await this.dbService.setItem('opdDetails', this.opdDetail);
  }

  getAllOpd(): Observable<Opd[]> {
    return defer(async () => {
      await this.loadOpdData();
      this.total = this.opdDetail.length;
      return this.opdDetail;
    });
  }

  getAllOpds(): Observable<Opd[]> {
  return defer(async () => {
    await this.loadOpdData();
    this.total = this.opdDetail.length;
    return this.opdDetail;
  });
}


  findOpds(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Opd[]> {
    return defer(async () => {
      await this.loadOpdData();
      this.total = this.opdDetail.length;

      const start = pageNumber * pageSize;
      const end = Math.min(start + pageSize, this.opdDetail.length);
      return this.opdDetail.slice(start, end);
    });
  }

  getOpdDetails(id: number | string): Observable<Opd> {
    return defer(async () => {
      await this.loadOpdData();
      const requested = String(id);
      // Prefer an encounter ID. Numeric MR lookup remains for older callers and legacy links.
      const opd = this.opdDetail.find(o => String(o.visitId || '') === requested)
        || this.opdDetail.find(o => o.patientId === Number(id));
      return opd!;
    });
  }

  async addNewOpd(data: Opd): Promise<boolean> {
    try {
      if (!this.validRegistration(data)) return false;
      await this.loadOpdData();
      const visitId = data.visitId || this.newVisitId();
      if (this.opdDetail.some(o => String(o.visitId || o.patientId) === visitId)) return false;
      const saved = { ...data, visitId };
      await this.dbService.insertRecord('opdDetails', visitId, saved);
      this.opdDetail.push(saved);
      return true;
    } catch (e) {
      console.error('Error adding new OPD:', e);
      return false;
    }
  }

  async updateOpd(data: Opd & {oldPatientId?: number}): Promise<boolean> {
    try {
      if (!this.validRegistration(data)) return false;
      await this.loadOpdData();
      const requestedVisitId = data.visitId || '';
      const index = requestedVisitId
        ? this.opdDetail.findIndex(o => String(o.visitId || '') === requestedVisitId)
        : data.oldPatientId !== undefined ? this.opdDetail.findIndex(o => o.patientId === data.oldPatientId) : -1;
      if (index !== -1) {
        const oldId = String(this.opdDetail[index].visitId || this.opdDetail[index].patientId);
        const updated = { ...data, visitId: oldId } as Opd & { oldPatientId?: number };
        delete updated.oldPatientId;
        await this.dbService.upsertRecord('opdDetails', updated.visitId!, updated, index);
        this.opdDetail = this.opdDetail.filter((_, i) => i !== index).concat(updated);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating OPD:', e);
      return false;
    }
  }

  private validRegistration(data: Opd): boolean {
    return Number.isSafeInteger(data.patientId) && data.patientId > 0
      && (data.sex == null || data.sex === '' || ['Male', 'Female'].includes(data.sex))
      && (data.age == null || (Number.isFinite(data.age) && data.age >= 0 && data.age <= 120));
  }

  private newVisitId(): string {
    return globalThis.crypto?.randomUUID?.() || 'opd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  async deleteOpd(id: number | string): Promise<boolean> {
    try {
      await this.loadOpdData();
      const requested = String(id);
      const target = this.opdDetail.find(opd => String(opd.visitId || '') === requested)
        || this.opdDetail.find(opd => opd.patientId === Number(id));
      if (!target) {
        return false;
      }
      const key = String(target.visitId || target.patientId);
      await this.dbService.deleteRecord('opdDetails', key);
      this.opdDetail = this.opdDetail.filter(opd => String(opd.visitId || opd.patientId) !== key);
      this.total = this.opdDetail.length;
      return true;
    } catch (e) {
      console.error('Error deleting OPD:', e);
      return false;
    }
  }
}
