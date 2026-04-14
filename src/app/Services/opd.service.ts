import { Injectable } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { Opd } from '../Models/opd.model';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class OpdService {
  total: number = 0;
  opdDetail: Opd[] = [];

  constructor(private dbService: IndexedDbService) {}

  private async loadOpdData(): Promise<void> {
    const storedOpd = await this.dbService.getItem<Opd[]>('opdDetails');
    this.opdDetail = storedOpd ?? [];
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

  getOpdDetails(id: number): Observable<Opd> {
    return defer(async () => {
      await this.loadOpdData();
      const opd = this.opdDetail.find(o => o.patientId === id);
      return opd!;
    });
  }

  async addNewOpd(data: Opd): Promise<boolean> {
    try {
      if (!data.createdAt) {
        data.createdAt = new Date().toISOString();
      }
      await this.loadOpdData();
      if (data.patientId > 0) {
        // Check for duplicate MR No
        if (this.opdDetail.some(o => o.patientId === data.patientId)) {
          console.error('Duplicate MR No (patientId) exists');
          return false;
        }
      } else {
        // Auto-generate new ID
        const maxId = this.opdDetail.length > 0 ? Math.max(...this.opdDetail.map(o => o.patientId)) : 0;
        data.patientId = maxId + 1;
      }
      this.opdDetail.push(data);
      await this.savePatientOpdData();
      return true;
    } catch (e) {
      console.error('Error adding new OPD:', e);
      return false;
    }
  }

  async updateOpd(data: Opd & {oldPatientId?: number}): Promise<boolean> {
    try {
      await this.loadOpdData();
      const oldId = data.oldPatientId;
      const index = oldId ? this.opdDetail.findIndex(o => o.patientId === oldId) : -1;
      if (index !== -1) {
        const newId = data.patientId;
        if (newId !== oldId && this.opdDetail.some(o => o.patientId === newId)) {
          console.error('New MR No already exists');
          return false;
        }
        this.opdDetail[index] = data;
        console.log("Updated OPD:", this.opdDetail[index]);
        await this.savePatientOpdData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating OPD:', e);
      return false;
    }
  }

  deleteOpd(id: number): Promise<boolean> {
    return this.loadOpdData().then(() => {
      try {
        const index = this.opdDetail.findIndex(opd => opd.patientId === id);
        if (index !== -1) {
          this.opdDetail.splice(index, 1);
          return this.savePatientOpdData().then(() => true);
        }
        return false;
      } catch (e) {
        console.error('Error deleting OPD:', e);
        return false;
      }
    });
  }
}
