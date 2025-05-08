import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LabPatient } from '../Models/lab.model';


@Injectable({
  providedIn: 'root'
})
export class LabService {
  total: number = 0;
  labDetail: LabPatient[] = [];

  constructor() {
    this.loadLabData();
  }

  private loadLabData() {
    const storedPatients = localStorage.getItem('labDetails');
    if (storedPatients) {
      this.labDetail = JSON.parse(storedPatients);
    } else {
      this.labDetail = [];
    }
  }

  // Method to save data to localStorage
  private saveLabData() {
    localStorage.setItem('labDetails', JSON.stringify(this.labDetail));
  }

  getAllLabPatient(): Observable<LabPatient[]> {
    let labPatientList: LabPatient[] = this.getLabPatientBrief();
    this.total = this.labDetail.length;

    return new Observable<LabPatient[]>(obs => {
      obs.next(labPatientList);
    });
  }

  findLabPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<LabPatient[]> {
    this.total = this.labDetail.length;
    let lab: LabPatient[] = this.getLabPatientBrief();

    let start = pageNumber * pageSize;
    let n = start + pageSize;
    let end = (n < lab.length) ? n : lab.length;
    let temp = lab.slice(start, end);

    return new Observable<LabPatient[]>(obs => {
      obs.next(temp);
    });
  }

  getLabPatientDetails(id: number): Observable<LabPatient> {
    return new Observable<LabPatient>(obs => {
      let temp:any = this.labDetail.find((o: any) => o.patientId == id);
      obs.next(temp);
    });
  }

  addNewLabPatient(data: LabPatient): boolean {
    try {
      // Generate a new patient ID
      let id: number = (this.labDetail?.length ?? 0) > 0
        ? (this.labDetail![this.labDetail.length - 1].patientId ?? 0) + 1
        : 1;
      data.patientId = id;

      // Add the new patient to the list
      this.labDetail.push(data);

      // Save the updated list to localStorage
      this.saveLabData();

      return true;
    } catch (e) {
      console.error('Error adding new patient:', e);
      return false;
    }
  }

  updateLabPatient(data: LabPatient): boolean {
    try {
      let i: number = this.labDetail.findIndex((o: any) => o.patientId == data.patientId);
      if (i !== -1) {
        this.labDetail[i] = data;
        this.saveLabData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating patient:', e);
      return false;
    }
  }

  getLabPatientBrief(): LabPatient[] {
    let labList: LabPatient[] = [];

    const storedLabPatients: any = localStorage.getItem('labDetails');
    const labPatients: any = storedLabPatients ? JSON.parse(storedLabPatients) : [];

    labPatients.forEach((data: any) =>
      labList.push({
        patientId: data.patientId,
        name: data.name,
        phone: data.phone,
        testName: data.testName,
        price: data.price,
        suggestedDr: data.suggestedDr,
        dateTime: data.dateTime
      })
    );

    this.labDetail = labPatients;

    return labList;
  }
}
