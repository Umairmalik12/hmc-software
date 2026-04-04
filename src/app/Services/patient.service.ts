import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../Models/patient.model';
import { PatientDetail } from '../Models/patientDetail.model';
import { IndexedDbService } from './indexed-db.service';

const STORAGE_KEY = 'patientDetails';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  total: number = 0;
  patientDetail: PatientDetail[] = [];

  constructor(private indexedDb: IndexedDbService) {
    this.loadPatientData();
  }

  private async loadPatientData(): Promise<void> {
    const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY);
    this.patientDetail = storedPatients || [];
  }

  private async savePatientData(): Promise<void> {
    await this.indexedDb.setItem(STORAGE_KEY, this.patientDetail);
  }

  getAllPatient(): Observable<Patient[]> {
    return new Observable<Patient[]>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patients = data || [];
        this.patientDetail = patients;
        this.total = patients.length;
        observer.next(this.getPatientBrief(patients));
        observer.complete();
      });
    });
  }

  findPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Patient[]> {
    return new Observable<Patient[]>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patients = data || [];
        this.patientDetail = patients;
        this.total = patients.length;

        const all = this.getPatientBrief(patients);
        const start = pageNumber * pageSize;
        const end = Math.min(start + pageSize, all.length);
        observer.next(all.slice(start, end));
        observer.complete();
      });
    });
  }

  getPatientDetails(id: number): Observable<PatientDetail | undefined> {
    return new Observable<PatientDetail>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patient:any = (data || []).find(p => p.patientId === id);
        observer.next(patient);
        observer.complete();
      });
    });
  }

  async addNewPatient(data: PatientDetail): Promise<boolean> {
    try {
      const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
      if (data.patientId > 0) {
        // Check for duplicate MR No
        if (storedPatients.some(p => p.patientId === data.patientId)) {
          console.error('Duplicate MR No (patientId) exists');
          return false;
        }
      } else {
        // Auto-generate new ID
        const maxId = storedPatients.length > 0 ? Math.max(...storedPatients.map(p => p.patientId)) : 0;
        data.patientId = maxId + 1;
      }

      storedPatients.push(data);
      await this.indexedDb.setItem(STORAGE_KEY, storedPatients);
      this.patientDetail = storedPatients;
      return true;
    } catch (e) {
      console.error('Error adding new patient:', e);
      return false;
    }
  }

  async updatePatient(data: any): Promise<boolean> {
    try {
      const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
      const oldId = data.oldId;
      const index = oldId ? storedPatients.findIndex(p => p.patientId === oldId) : -1;
      if (index !== -1) {
        const newId = data.patientId;
        if (newId !== oldId && storedPatients.some(p => p.patientId === newId)) {
          console.error('New MR No already exists');
          return false;
        }
        storedPatients[index] = data;
        delete data.oldId;
        await this.indexedDb.setItem(STORAGE_KEY, storedPatients);
        this.patientDetail = storedPatients;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating patient:', e);
      return false;
    }
  }

  private getPatientBrief(patients: PatientDetail[]): Patient[] {
    return patients.map(p => ({
      patientId: p.patientId,
      name: `${p.firstName} ${p.lastName}`,
      contact: p.phone,
      drName: p.drName,
      gender: p.gender,
      age: p.age,
      maritalStatus: p.maritalStatus,
      city: p.city,
      address: p.address
    }));
  }

  async deletePatient(id: number): Promise<boolean> {
  try {
    const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
    const updatedPatients = storedPatients.filter(p => p.patientId !== id);

    if (updatedPatients.length === storedPatients.length) {
      return false;
    }

    await this.indexedDb.setItem(STORAGE_KEY, updatedPatients);
    this.patientDetail = updatedPatients;
    return true;
  } catch (e) {
    console.error('Error deleting patient:', e);
    return false;
  }
}

}
