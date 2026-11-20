import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../Models/patient.model';
import { PatientDetail } from '../Models/patientDetail.model';
import { SupabaseDataService } from './supabase-data.service';

const STORAGE_KEY = 'patientDetails';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  total: number = 0;
  patientDetail: PatientDetail[] = [];

  constructor(private indexedDb: SupabaseDataService) {
  }

  private async loadPatientData(): Promise<void> {
    const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY);
    this.patientDetail = storedPatients || [];
  }

  private sortNewestFirst<T extends { createdAt?: any; dateTime?: any; patientId?: any; medicineId?: any; inpatientId?: any; id?: any }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      const idA = Number(a.patientId ?? a.medicineId ?? a.inpatientId ?? a.id ?? 0);
      const idB = Number(b.patientId ?? b.medicineId ?? b.inpatientId ?? b.id ?? 0);
      return idB - idA;
    });
  }

  getAllPatient(): Observable<Patient[]> {
    return new Observable<Patient[]>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patients = this.sortNewestFirst(data || []);
        this.patientDetail = patients;
        this.total = patients.length;
        observer.next(this.getPatientBrief(patients));
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  findPatients(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Patient[]> {
    return new Observable<Patient[]>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patients = this.sortNewestFirst(data || []);
        this.patientDetail = patients;
        this.total = patients.length;

        const all = this.getPatientBrief(patients);
        const start = pageNumber * pageSize;
        const end = Math.min(start + pageSize, all.length);
        observer.next(all.slice(start, end));
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  getPatientDetails(id: number): Observable<PatientDetail | undefined> {
    return new Observable<PatientDetail>(observer => {
      this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY).then(data => {
        const patient:any = (data || []).find(p => p.patientId === id);
        observer.next(patient);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  async addNewPatient(data: PatientDetail): Promise<boolean> {
    try {
      if (!this.validRegistration(data)) return false;
      if (!data.createdAt) {
        data.createdAt = new Date().toISOString();
      }
      const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
      if (storedPatients.some(p => p.patientId === data.patientId)) {
        console.error('Duplicate MR number exists');
        return false;
      }

      await this.indexedDb.insertRecord(STORAGE_KEY, data.patientId, data);
      storedPatients.push(data);
      this.patientDetail = storedPatients;
      this.total = storedPatients.length;
      return true;
    } catch (e) {
      console.error('Error adding new patient:', e);
      return false;
    }
  }

  async updatePatient(data: PatientDetail): Promise<boolean> {
    try {
      if (!this.validRegistration(data)) return false;
      const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
      const oldId = data.oldId;
      const index = oldId ? storedPatients.findIndex(p => p.patientId === oldId) : -1;
      if (index !== -1) {
        const newId = data.patientId;
        if (newId !== oldId && storedPatients.some(p => p.patientId === newId)) {
          console.error('New MR No already exists');
          return false;
        }
        const updatedPatient = { ...data };
        delete updatedPatient.oldId;
        if (oldId === undefined) {
          return false;
        }
        if (newId === oldId) {
          await this.indexedDb.upsertRecord(STORAGE_KEY, newId, updatedPatient, index);
        } else {
          await this.indexedDb.moveRecord(STORAGE_KEY, oldId, newId, updatedPatient);
        }
        this.patientDetail = storedPatients.map((patient, row) => row === index ? updatedPatient : patient);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating patient:', e);
      return false;
    }
  }

  private validRegistration(data: PatientDetail): boolean {
    return Number.isSafeInteger(data.patientId) && data.patientId > 0
      && (data.gender == null || data.gender === '' || ['Male', 'Female'].includes(data.gender))
      && (data.age == null || (Number.isFinite(data.age) && data.age >= 0 && data.age <= 120));
  }

  private getPatientBrief(patients: PatientDetail[]): Patient[] {
    return patients.map(p => ({
      patientId: p.patientId,
      name: [p.firstName, p.lastName].filter(Boolean).join(' '),
      contact: p.phone,
      drName: p.drName,
      gender: p.gender,
      age: p.age,
      maritalStatus: p.maritalStatus,
      city: p.city,
      address: p.address,
      procedure: p.procedure,
      createdAt: p.createdAt
    }));
  }

  async deletePatient(id: number): Promise<boolean> {
  try {
    const storedPatients = await this.indexedDb.getItem<PatientDetail[]>(STORAGE_KEY) || [];
    if (!storedPatients.some(p => p.patientId === id)) {
      return false;
    }

    await this.indexedDb.deleteRecord(STORAGE_KEY, id);
    const updatedPatients = storedPatients.filter(p => p.patientId !== id);
    this.patientDetail = updatedPatients;
    return true;
  } catch (e) {
    console.error('Error deleting patient:', e);
    return false;
  }
}

}
