import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medicine } from '../Models/medicine.model';
import { IndexedDbService } from './indexed-db.service';

const STORAGE_KEY = 'medicineDetails';

@Injectable({
  providedIn: 'root'
})
export class MedicineService {
  total: number = 0;
  medicineDetail: Medicine[] = [];

  constructor(private indexedDb: IndexedDbService) {
    this.loadMedicineData();
  }

  private async loadMedicineData(): Promise<void> {
    const storedMedicines = await this.indexedDb.getItem<Medicine[]>(STORAGE_KEY);
    this.medicineDetail = storedMedicines || [];
  }

  private async saveMedicineData(): Promise<void> {
    await this.indexedDb.setItem(STORAGE_KEY, this.medicineDetail);
  }

  getAllMedicine(): Observable<Medicine[]> {
    return new Observable<Medicine[]>(observer => {
      this.indexedDb.getItem<Medicine[]>(STORAGE_KEY).then(data => {
        const medicines = data || [];
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
        const medicines = data || [];
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
      const id = storedMedicines.length > 0 ? storedMedicines[storedMedicines.length - 1].medicineId + 1 : 1;
      data.medicineId = id;

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
      let id = storedMedicines.length > 0 ? storedMedicines[storedMedicines.length - 1].medicineId + 1 : 1;
      for (const data of medicines) {
        data.medicineId = id++;
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
          data.medicineId = storedMedicines.length > 0 ? storedMedicines[storedMedicines.length - 1].medicineId + 1 : 1;
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

