import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LabPatient } from '../Models/lab.model';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class LabService {
  total: number = 0;
  labDetail: LabPatient[] = [];

  constructor(private indexedDbService: IndexedDbService) {
    this.loadLabData();
  }

  private loadLabData(): void {
    this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
      this.labDetail = data ?? [];
    });
  }

  private saveLabData(): Promise<void> {
    return this.indexedDbService.setItem('labDetails', this.labDetail);
  }

  getAllLabPatient(): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = data ?? [];
        this.total = this.labDetail.length;
        observer.next(this.labDetail);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  findLabPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = data ?? [];
        this.total = this.labDetail.length;

        let start = pageNumber * pageSize;
        let end = Math.min(start + pageSize, this.labDetail.length);
        let paginated = this.labDetail.slice(start, end);

        observer.next(paginated);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  getLabPatientDetails(id: number): Observable<LabPatient> {
    return new Observable<LabPatient>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        this.labDetail = data ?? [];
        const patient = this.labDetail.find(o => o.patientId === id);
        observer.next(patient as LabPatient);
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  addNewLabPatient(data: LabPatient): Observable<boolean> {
    return new Observable<boolean>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(stored => {
        this.labDetail = stored ?? [];

        const id = this.labDetail.length > 0
          ? (this.labDetail[this.labDetail.length - 1].patientId ?? 0) + 1
          : 1;
        data.patientId = id;

        this.labDetail.push(data);
        this.saveLabData().then(() => {
          observer.next(true);
          observer.complete();
        }).catch(err => observer.error(err));
      }).catch(err => observer.error(err));
    });
  }

  updateLabPatient(data: LabPatient): Observable<boolean> {
    return new Observable<boolean>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(stored => {
        this.labDetail = stored ?? [];

        const index = this.labDetail.findIndex(o => o.patientId === data.patientId);
        if (index !== -1) {
          this.labDetail[index] = data;
          this.saveLabData().then(() => {
            observer.next(true);
            observer.complete();
          }).catch(err => observer.error(err));
        } else {
          observer.next(false);
          observer.complete();
        }
      }).catch(err => observer.error(err));
    });
  }

  getLabPatientBrief(): Observable<LabPatient[]> {
    return new Observable<LabPatient[]>(observer => {
      this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
        const list: LabPatient[] = (data ?? []).map(p => ({
          patientId: p.patientId,
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

  deleteLabPatient(id: number): Observable<boolean> {
  return new Observable<boolean>(observer => {
    this.indexedDbService.getItem<LabPatient[]>('labDetails').then(data => {
      this.labDetail = data ?? [];

      const index = this.labDetail.findIndex(p => p.patientId === id);
      if (index !== -1) {
        this.labDetail.splice(index, 1);
        this.saveLabData().then(() => {
          observer.next(true);
          observer.complete();
        }).catch(err => observer.error(err));
      } else {
        observer.next(false);
        observer.complete();
      }
    }).catch(err => observer.error(err));
  });
}

}
