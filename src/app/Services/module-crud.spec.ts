import { firstValueFrom } from 'rxjs';
import { memoryDb } from '../testing/memory-db';
import { PatientService } from './patient.service';
import { OpdService } from './opd.service';
import { LabService } from './lab.service';
import { InpatientService } from './inpatient.service';
import { MedicineService } from './medicine.service';

describe('Core module CRUD persistence', () => {
  const modules = [
    { service: PatientService, collection: 'patientDetails', id: 'patientId', name: 'firstName', add: 'addNewPatient', read: 'getPatientDetails', all: 'getAllPatient', update: 'updatePatient', remove: 'deletePatient', old: 'oldId' },
    { service: OpdService, collection: 'opdDetails', id: 'patientId', name: 'patientName', add: 'addNewOpd', read: 'getOpdDetails', all: 'getAllOpds', update: 'updateOpd', remove: 'deleteOpd', old: 'oldPatientId' },
    { service: LabService, collection: 'labDetails', id: 'patientId', name: 'name', add: 'addNewLabPatient', read: 'getLabPatientDetails', all: 'getAllLabPatient', update: 'updateLabPatient', remove: 'deleteLabPatient' },
    { service: InpatientService, collection: 'inpatientDetails', id: 'inpatientId', name: 'patientName', add: 'addNewInpatient', read: 'getInpatientDetails', all: 'getAllInpatient', update: 'updateInpatient', remove: 'deleteInpatient' },
    { service: MedicineService, collection: 'medicineDetails', id: 'medicineId', name: 'patientName', add: 'addNewMedicine', read: 'getMedicineDetails', all: 'getAllMedicine', update: 'updateMedicine', remove: 'deleteMedicine' },
  ];
  for (const module of modules) {
    it(`creates, reads, updates and deletes ${module.collection} without overwriting another record`, async () => {
      const { db, collections } = memoryDb();
      const other = { [module.id]: 900, [module.name]: 'Another patient', createdAt: '2020-01-01T00:00:00Z', medicines: [] };
      collections.set(module.collection, new Map([['900', other]]));
      const service: any = new module.service(db);
      const draft = { [module.id]: 0, [module.name]: 'Ali', lastName: '', gender: '', age: 30, phone: '', city: '', address: '', drName: '',
        procedure: 'Cystoscopy', surgeonName: '', admissionDate: '', dischargeDate: '', roomNo: '', doctorName: '',
        medicines: [{ medicineName: 'Medicine A', quantity: 2 }], name: 'Ali', testName: 'CBC', price: 0, suggestedDr: '', dateTime: new Date().toISOString(), createdAt: '' };
      expect(await service[module.add](draft)).toBeTrue();
      const id = (draft as any)[module.id];
      expect((await firstValueFrom<any>(service[module.read](id)))[module.name]).toBe('Ali');
      expect((await firstValueFrom<any[]>(service[module.all]())).length).toBe(2);
      const update: any = { ...draft, [module.name]: 'Updated patient' };
      if (module.old) update[module.old] = id;
      expect(await service[module.update](update)).toBeTrue();
      expect((await firstValueFrom<any>(service[module.read](id)))[module.name]).toBe('Updated patient');
      expect(collections.get(module.collection)!.get('900')).toEqual(other);
      expect(await service[module.remove](id)).toBeTrue();
      expect(await firstValueFrom(service[module.read](id))).toBeUndefined();
      expect(collections.get(module.collection)!.get('900')).toEqual(other);
      expect(db.setItem).not.toHaveBeenCalled();
    });

    it(`reports failed reads for ${module.collection} rather than leaving its observable pending`, async () => {
      const { db } = memoryDb();
      (db.getItem as jasmine.Spy).and.rejectWith(new Error('offline'));
      const service: any = new module.service(db);
      await expectAsync(firstValueFrom(service[module.all]())).toBeRejectedWithError('offline');
    });
  }
});
