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

  addNewOpd(data: Opd | any): Promise<boolean> {
    return this.loadOpdData().then(() => {
      try {
        const id = this.opdDetail.length > 0
          ? this.opdDetail[this.opdDetail.length - 1].patientId + 1
          : 1;
        data.patientId = id;
        this.opdDetail.push(data);
        return this.savePatientOpdData().then(() => true);
      } catch (e) {
        console.error('Error adding new OPD:', e);
        return false;
      }
    });
  }

  updateOpd(data: Opd): Promise<boolean> {
    return this.loadOpdData().then(() => {
      try {
        const index = this.opdDetail.findIndex(o => o.patientId === data.patientId);
        if (index !== -1) {
          this.opdDetail[index] = data;
          console.log("Updated OPD:", this.opdDetail[index]);
          return this.savePatientOpdData().then(() => true);
        }
        return false;
      } catch (e) {
        console.error('Error updating OPD:', e);
        return false;
      }
    });
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
