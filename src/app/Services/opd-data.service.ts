import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OpdService } from './opd.service';
import { Opd } from '../Models/opd.model';

@Injectable({
  providedIn: 'root'
})
export class OpdDataService implements DataSource<Opd> {
  private opdSubject = new BehaviorSubject<Opd[]>([]);

  constructor(private opdService: OpdService) { }

  loadPatient(filter: string, sortDirection: string,
    pageIndex: number, pageSize: number) {

    this.opdService.findOpds(filter, sortDirection, pageIndex, pageSize)
      .pipe(catchError(() => of([])))
      .subscribe(opd => this.opdSubject.next(opd));
  }

  connect(collectionViewer: CollectionViewer): Observable<Opd[] | readonly Opd[]> {

    return this.opdSubject.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    this.opdSubject.complete();
  }
}
