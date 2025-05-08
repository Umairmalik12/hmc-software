import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../Models/patient.model';
import { PatientDetail } from '../Models/patientDetail.model';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  total: number = 0;
  patientDetail: PatientDetail[] = [];

  constructor() {
    // On initialization, load data from localStorage
    this.loadPatientData();
  }

  // Method to load data from localStorage
  private loadPatientData() {
    const storedPatients = localStorage.getItem('patientDetails');
    if (storedPatients) {
      this.patientDetail = JSON.parse(storedPatients);
    } else {
      this.patientDetail = [];  // Fallback if nothing is in localStorage
    }
  }

  // Method to save data to localStorage
  private savePatientData() {
    localStorage.setItem('patientDetails', JSON.stringify(this.patientDetail));
  }

  getAllPatient(): Observable<Patient[]> {
    let patientList: Patient[] = this.getPatientBrief();
    this.total = this.patientDetail.length;

    return new Observable<Patient[]>(obs => {
      obs.next(patientList);
    });
  }

  findPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Patient[]> {
    this.total = this.patientDetail.length;
    let patient: Patient[] = this.getPatientBrief();

    let start = pageNumber * pageSize;
    let n = start + pageSize;
    let end = (n < patient.length) ? n : patient.length;
    let temp = patient.slice(start, end);

    return new Observable<Patient[]>(obs => {
      obs.next(temp);
    });
  }

  getPatientDetails(id: number): Observable<PatientDetail> {
    return new Observable<PatientDetail>(obs => {
      let temp:any = this.patientDetail.find((o: any) => o.patientId == id);
      obs.next(temp);
    });
  }

  addNewPatient(data: PatientDetail): boolean {
    try {
      // Generate a new patient ID
      let id: number = this.patientDetail.length > 0 ? this.patientDetail[this.patientDetail.length - 1].patientId + 1 : 1;
      data.patientId = id;

      // Add the new patient to the list
      this.patientDetail.push(data);

      // Save the updated list to localStorage
      this.savePatientData();

      return true;
    } catch (e) {
      console.error('Error adding new patient:', e);
      return false;
    }
  }

  updatePatient(data: PatientDetail): boolean {
    try {
      let i: number = this.patientDetail.findIndex((o: any) => o.patientId == data.patientId);
      if (i !== -1) {
        this.patientDetail[i] = data;
        this.savePatientData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating patient:', e);
      return false;
    }
  }

  getPatientBrief(): Patient[] {
    let patientList: Patient[] = [];

    // Load patient data from localStorage if available
    const storedPatients: any = localStorage.getItem('patientDetails');
    const patients: any = storedPatients ? JSON.parse(storedPatients) : [];

    patients.forEach((data: any) =>
      patientList.push({
        patientId: data.patientId,
        name: data.firstName + " " + data.lastName,
        contact: data.phone,
        drName: data.drName,
        gender: data.gender,
        age: data.age,
        maritalStatus: data.maritalStatus,
        dob: data.dob,
        email: data.email,
        state: data.state,
        address: data.address
      })
    );

    // Update patientDetail array after loading data
    this.patientDetail = patients;

    return patientList;
  }
}
