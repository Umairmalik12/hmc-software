import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Opd } from '../Models/opd.model';

@Injectable({
  providedIn: 'root'
})
export class OpdService {
  total: number = 0;
  opdDetail: Opd[] = [];

  constructor() {
    this.loadOpdData();
  }

  private loadOpdData() {
    const storedOpd = localStorage.getItem('opdDetails');
    if (storedOpd) {
      this.opdDetail = JSON.parse(storedOpd);
    } else {
      this.opdDetail = [];
    }
  }

  private savePatientOpdData() {
    console.log("this.opdDetail",this.opdDetail)
    localStorage.setItem('opdDetails', JSON.stringify(this.opdDetail));
  }

  getAllOpd(): Observable<Opd[]> {
    let OpdList: Opd[] = this.getOpdBrief();
    this.total = this.opdDetail.length;

    return new Observable<Opd[]>(obs => {
      obs.next(OpdList);
    });
  }

  findOpds(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Opd[]> {
    this.total = this.opdDetail.length;
    let opd: Opd[] = this.getOpdBrief();

    let start = pageNumber * pageSize;
    let n = start + pageSize;
    let end = (n < opd.length) ? n : opd.length;
    let temp = opd.slice(start, end);

    return new Observable<Opd[]>(obs => {
      obs.next(temp);
    });
  }

  getOpdDetails(id: number): Observable<Opd> {
    return new Observable<Opd>(obs => {
      let temp = this.opdDetail.find((o: any) => o.patientId == id);
      obs.next(temp);
    });
  }

  addNewOpd(data: Opd): boolean {
    try {
      let id: number = this.opdDetail.length > 0 ? this.opdDetail[this.opdDetail.length - 1].patientId + 1 : 1;
      data.patientId = id;
      this.opdDetail.push(data);
      this.savePatientOpdData();

      return true;
    } catch (e) {
      console.error('Error adding new opd:', e);
      return false;
    }
  }

  updateOpd(data: Opd): boolean {
    try {
      let i: number = this.opdDetail.findIndex((o: any) => o.patientId == data.patientId);
      if (i !== -1) {
        this.opdDetail[i] = data;
        console.log("this.opdDetail[i]",this.opdDetail[i])
        this.savePatientOpdData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating patient:', e);
      return false;
    }
  }

  getOpdBrief(): Opd[] {
    let opdList: Opd[] = [];

    // Load patient data from localStorage if available
    const storedOpd: any = localStorage.getItem('opdDetails');
    const opds: any = storedOpd ? JSON.parse(storedOpd) : [];
console.log("opds",opds)
    opds.forEach((data: any) =>
      opdList.push({
        patientId: data.patientId,
        patientName: data.patientName,
        phone: data.phone,
        drName: data.drName,
        sex: data.sex,
        age: data.age,
        bp: data.bp,
        temp: data.temp,
        weight: data.weight,
        patientCategory: data.patientCategory,
        address: data.address,
        history: data.history,
        amount: data.amount,
        dateTime: data.dateTime,
        followUp: data.followUp

      })
    );

    this.opdDetail = opds;

    return opdList;
  }
}
