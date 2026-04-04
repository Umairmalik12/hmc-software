import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { InPatient } from '../Models/inpatient.model';
import { InpatientService } from './inpatient.service';

@Injectable({
  providedIn: 'root'
})
export class InpatientDataService implements DataSource<InPatient>{

  private inpatientSubject = new BehaviorSubject<InPatient[]>([]);

  // Allow updating the subject for filtering
  public updateInpatients(inpatients: InPatient[]) {
    this.inpatientSubject.next(inpatients);
  }

  constructor(private inpatientService: InpatientService){ }
  
  loadInpatient(filter: string, sortDirection: string,
                pageIndex: number, pageSize: number){

    this.inpatientService.findInpatients(filter, sortDirection, pageIndex, pageSize)
                        .pipe( catchError(()=> of([])) )
                        .subscribe(inpatients => this.inpatientSubject.next(inpatients));
  }

  connect(collectionViewer: CollectionViewer): Observable<InPatient[] | readonly InPatient[]> {
    return this.inpatientSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.inpatientSubject.complete();
  }
}
