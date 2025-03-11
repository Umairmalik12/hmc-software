import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LabPatient } from '../Models/lab.model';
import { LabService } from './lab.service';

@Injectable({
  providedIn: 'root'
})
export class LabPatientDataService implements DataSource<LabPatient>{

  private labSubject= new BehaviorSubject<LabPatient[]>([]);

  constructor(private labPatientService: LabService){ }
  
  loadLabPatient(filter: string, sortDirection: string,
               pageIndex: number, pageSize: number){

        this.labPatientService.findLabPatients(filter, sortDirection, pageIndex, pageSize)
                            .pipe( catchError(()=> of([])) )
                            .subscribe(labPatient=> this.labSubject.next(labPatient));
    }

  connect(collectionViewer: CollectionViewer): Observable<LabPatient[] | readonly LabPatient[]> {
    
    return this.labSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.labSubject.complete();
  }
}
