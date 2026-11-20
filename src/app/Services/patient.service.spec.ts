import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { PatientDetail } from '../Models/patientDetail.model';
import { SupabaseDataService } from './supabase-data.service';
import { PatientService } from './patient.service';
import { memoryDb } from '../testing/memory-db';

describe('PatientService', () => {
  let service: PatientService;
  let supabase: jasmine.SpyObj<SupabaseDataService>;
  let storedPatients: PatientDetail[];

  beforeEach(() => {
    storedPatients = [];
    supabase = jasmine.createSpyObj<SupabaseDataService>('SupabaseDataService', ['getItem', 'setItem', 'allocateId', 'moveRecord', 'insertRecord', 'upsertRecord', 'deleteRecord']);
    supabase.getItem.and.callFake(async <T>() => storedPatients as unknown as T);
    supabase.setItem.and.callFake((_key: string, value: PatientDetail[]) => {
      storedPatients = value;
      return Promise.resolve();
    });
    supabase.allocateId.and.returnValue(Promise.resolve(1));
    supabase.moveRecord.and.returnValue(Promise.resolve());
    supabase.upsertRecord.and.returnValue(Promise.resolve());
    supabase.insertRecord.and.resolveTo();
    supabase.deleteRecord.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({imports: [FeedbackModule],
      providers: [
        PatientService,
        { provide: SupabaseDataService, useValue: supabase },
      ],
    });
    service = TestBed.inject(PatientService);
  });

  it('saves a new patient with the manually entered MR number without allocating one', async () => {
    const patient: PatientDetail = {
      patientId: 8123,
      firstName: 'Ali',
      lastName: 'Khan',
      drName: 'Dr Example',
      gender: 'Male',
      age: 30,
      maritalStatus: 'Married',
      phone: '03001234567',
      city: 'Lahore',
      address: 'Main Road',
      procedure: 'Checkup',
      createdAt: '',
    };

    const saved = await service.addNewPatient(patient);

    expect(saved).toBeTrue();
    expect(patient.patientId).toBe(8123);
    expect(supabase.allocateId).not.toHaveBeenCalled();
    expect(supabase.insertRecord).toHaveBeenCalledWith('patientDetails', 8123, patient);
    expect(supabase.upsertRecord).not.toHaveBeenCalled();
    expect(supabase.setItem).not.toHaveBeenCalled();
    expect(service.patientDetail).toEqual([patient]);
  });

  it('rejects missing or invalid MR numbers without allocating or saving a record', async () => {
    for (const patientId of [undefined, null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(await service.addNewPatient({ patientId, firstName: 'Ali' } as PatientDetail)).toBeFalse();
    }
    expect(supabase.allocateId).not.toHaveBeenCalled(); expect(supabase.insertRecord).not.toHaveBeenCalled(); expect(supabase.getItem).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing MR or retry a rejected insert as an upsert', async () => {
    const patient = { patientId: 8123, firstName: 'Ali', gender: 'Male', age: 30 } as PatientDetail;
    storedPatients.push({ ...patient, firstName: 'Existing patient' });
    expect(await service.addNewPatient(patient)).toBeFalse(); expect(supabase.insertRecord).not.toHaveBeenCalled();
    storedPatients = []; supabase.insertRecord.and.rejectWith(new Error('Duplicate MR'));
    expect(await service.addNewPatient(patient)).toBeFalse(); expect(supabase.upsertRecord).not.toHaveBeenCalled(); expect(supabase.allocateId).not.toHaveBeenCalled();
  });

  it('keeps the first registration when two submissions use the same manual MR concurrently', async () => {
    const { db, collections } = memoryDb();
    const first = new PatientService(db); const second = new PatientService(db);
    const results = await Promise.all([first.addNewPatient({ patientId: 8123, firstName: 'First patient' } as PatientDetail), second.addNewPatient({ patientId: 8123, firstName: 'Second patient' } as PatientDetail)]);
    expect(results).toEqual([true, false]); expect(collections.get('patientDetails')!.get('8123').firstName).toBe('First patient');
    expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });

  it('rejects unsupported gender and invalid ages before writing to the database', async () => {
    const valid = { patientId: 8123, firstName: 'Ali', gender: 'Male', age: 30 } as PatientDetail;
    for (const invalid of [{ gender: 'Other' }, { age: -1 }, { age: 121 }, { age: Number.NaN }]) {
      expect(await service.addNewPatient({ ...valid, ...invalid })).toBeFalse();
    }
    expect(supabase.insertRecord).not.toHaveBeenCalled(); expect(supabase.upsertRecord).not.toHaveBeenCalled();
  });

  it('updates an existing operation patient by its original MR number', async () => {
    const patient: PatientDetail = {
      patientId: 8,
      oldId: 3,
      firstName: 'Sara',
      lastName: 'Ali',
      drName: 'Dr Example',
      gender: 'Female',
      age: 25,
      maritalStatus: 'Single',
      phone: '03001234567',
      city: 'Lahore',
      address: 'Main Road',
      procedure: 'Review',
      createdAt: '2026-11-10T00:00:00.000Z',
    };
    storedPatients.push({ ...patient, patientId: 3, oldId: undefined });

    const saved = await service.updatePatient(patient);

    expect(saved).toBeTrue();
    expect(supabase.moveRecord).toHaveBeenCalledWith('patientDetails', 3, 8, jasmine.objectContaining({ patientId: 8 }));
    expect(storedPatients[0].patientId).toBe(3);
    expect(storedPatients[0].oldId).toBeUndefined();
  });
});
