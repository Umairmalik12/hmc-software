import { TestBed } from '@angular/core/testing';
import { PatientDetail } from '../Models/patientDetail.model';
import { SupabaseDataService } from './supabase-data.service';
import { PatientService } from './patient.service';

describe('PatientService', () => {
  let service: PatientService;
  let supabase: jasmine.SpyObj<SupabaseDataService>;
  let storedPatients: PatientDetail[];

  beforeEach(() => {
    storedPatients = [];
    supabase = jasmine.createSpyObj<SupabaseDataService>('SupabaseDataService', ['getItem', 'setItem', 'allocateId']);
    supabase.getItem.and.callFake(async <T>() => storedPatients as unknown as T);
    supabase.setItem.and.callFake((_key: string, value: PatientDetail[]) => {
      storedPatients = value;
      return Promise.resolve();
    });
    supabase.allocateId.and.returnValue(Promise.resolve(1));

    TestBed.configureTestingModule({
      providers: [
        PatientService,
        { provide: SupabaseDataService, useValue: supabase },
      ],
    });
    service = TestBed.inject(PatientService);
  });

  it('saves a new patient using the current stored records and assigns a missing MR number', async () => {
    const patient: PatientDetail = {
      patientId: 0,
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
    expect(patient.patientId).toBe(1);
    expect(storedPatients).toEqual([patient]);
    expect(supabase.allocateId).toHaveBeenCalledWith('patientDetails');
    expect(supabase.setItem).toHaveBeenCalledWith('patientDetails', [patient]);
    expect(service.patientDetail).toEqual([patient]);
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
    expect(storedPatients[0].patientId).toBe(8);
    expect(storedPatients[0].oldId).toBeUndefined();
  });
});
