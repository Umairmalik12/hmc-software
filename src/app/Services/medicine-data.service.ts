import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Medicine } from '../Models/medicine.model';
import { MedicineService } from './medicine.service';

@Injectable({
  providedIn: 'root'
})
export class MedicineDataService implements DataSource<Medicine>{

  private medicineSubject = new BehaviorSubject<Medicine[]>([]);

  public updateMedicines(medicines: Medicine[]) {
    this.medicineSubject.next(medicines);
  }

  constructor(private medicineService: MedicineService){ }
  
  loadMedicine(filter: string, sortDirection: string,
                pageIndex: number, pageSize: number){

    this.medicineService.findMedicines(filter, sortDirection, pageIndex, pageSize)
                        .pipe( catchError(()=> of([])) )
                        .subscribe(medicines => this.medicineSubject.next(medicines));
  }

  loadMedicines() {
    this.medicineService.getAllMedicine().subscribe(medicines => this.medicineSubject.next(medicines));
  }

  connect(collectionViewer: CollectionViewer): Observable<Medicine[] | readonly Medicine[]> {
    return this.medicineSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.medicineSubject.complete();
  }
}

