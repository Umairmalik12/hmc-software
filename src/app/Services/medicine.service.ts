import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medicine } from '../Models/medicine.model';
import { SupabaseDataService } from './supabase-data.service';

const STORAGE_KEY = 'medicineDetails';

@Injectable({
  providedIn: 'root'
})
export class MedicineService {
  total: number = 0;
  medicineDetail: Medicine[] = [];

  constructor(private indexedDb: SupabaseDataService) {
    this.loadMedicineData();
  }

  private async loadMedicineData(): Promise<void> {
    const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY);
    this.medicineDetail = storedMedicines || [];
  }

  private async saveMedicineData(): Promise<void> {
    await this.indexedDb.setItem(STORAGE_KEY, this.medicineDetail);
  }

  private sortNewestFirst(items: Medicine[]): Medicine[] {
    return [...items].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (Number(b.medicineId) || 0) - (Number(a.medicineId) || 0);
    });
  }

  getAllMedicine(): Observable<Medicine[]> {
    return new Observable<Medicine[]>(observer => {
      this.indexedDb.getItem<Medicine[]>(STORAGE_KEY).then(data => {
        const medicines = this.sortNewestFirst(data || []);
        this.medicineDetail = medicines;
        this.total = medicines.length;
        observer.next(medicines);
        observer.complete();
      });
    });
  }

  findMedicines(filter = '', sortOrder = 'asc', pageNumber = 0, pageSize = 5): Observable<Medicine[]> {
    return new Observable<Medicine[]>(observer => {
      this.indexedDb.getItem<Medicine[]>(STORAGE_KEY).then(data => {
        const medicines = this.sortNewestFirst(data || []);
        this.medicineDetail = medicines;
        this.total = medicines.length;

        const all = medicines;
        const start = pageNumber * pageSize;
        const end = Math.min(start + pageSize, all.length);
        observer.next(all.slice(start, end));
        observer.complete();
      });
    });
  }

  getMedicineDetails(id: number): Observable<Medicine | undefined> {
    return new Observable<Medicine>(observer => {
      this.indexedDb.getItem<Medicine[]>(STORAGE_KEY).then(data => {
        const medicine: any = (data || []).find(p => p.medicineId === id);
        observer.next(medicine);
        observer.complete();
      });
    });
  }

  async addNewMedicine(data: Medicine): Promise<boolean> {
    try {
      const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY) || [];
      data.medicineId = await this.indexedDb.allocateId(STORAGE_KEY);

      if (!data.createdAt) {
        data.createdAt = new Date().toISOString();
      }
    

      storedMedicines.push(data);
      await this.indexedDb.setItem(STORAGE_KEY, storedMedicines);
      this.medicineDetail = storedMedicines;
      return true;
    } catch (e) {
      console.error('Error adding new medicine:', e);
      return false;
    }
  }

  async addMultipleMedicines(medicines: Medicine[]): Promise<boolean> {
    try {
      const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY) || [];
      for (const data of medicines) {
        data.medicineId = await this.indexedDb.allocateId(STORAGE_KEY);
        if (!data.createdAt) {
          data.createdAt = new Date().toISOString();
        }
        storedMedicines.push(data);
      }
      await this.indexedDb.setItem(STORAGE_KEY, storedMedicines);
      this.medicineDetail = storedMedicines;
      return true;
    } catch (e) {
      console.error('Error adding multiple medicines:', e);
      return false;
    }
  }

  async updateMedicine(data: Medicine): Promise<boolean> {
    try {
      const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY) || [];
      const index = storedMedicines.findIndex(p => p.medicineId === data.medicineId);
      if (index !== -1) {
        storedMedicines[index] = data;
        await this.indexedDb.setItem(STORAGE_KEY, storedMedicines);
        this.medicineDetail = storedMedicines;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating medicine:', e);
      return false;
    }
  }

  async updateMultipleMedicines(medicines: Medicine[]): Promise<boolean> {
    try {
      const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY) || [];
      for (const data of medicines) {
        const index = storedMedicines.findIndex(p => p.medicineId === data.medicineId);
        if (index !== -1) {
          storedMedicines[index] = data;
        } else {
          // If not found, add as new
          data.medicineId = await this.indexedDb.allocateId(STORAGE_KEY);
          storedMedicines.push(data);
        }
      }
      await this.indexedDb.setItem(STORAGE_KEY, storedMedicines);
      this.medicineDetail = storedMedicines;
      return true;
    } catch (e) {
      console.error('Error updating multiple medicines:', e);
      return false;
    }
  }

  async deleteMedicine(id: number): Promise<boolean> {
    try {
      const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY) || [];
      const updatedMedicines = storedMedicines.filter(p => p.medicineId !== id);

      if (updatedMedicines.length === storedMedicines.length) {
        return false;
      }

      await this.indexedDb.setItem(STORAGE_KEY, updatedMedicines);
      this.medicineDetail = updatedMedicines;
      return true;
    } catch (e) {
      console.error('Error deleting medicine:', e);
      return false;
    }
  }
}
