import { FormBuilder } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PatientEditComponent } from './patient/patient-edit/patient-edit.component';
import { OpdEditComponent } from './opdslip/opd-edit/opd-edit.component';
import { InpatientEditComponent } from './inpatient/inpatient-edit/inpatient-edit.component';
import { LabEditComponent } from './lab/lab-edit/lab-edit.component';
import { MedicineEditComponent } from './medicine/medicine-edit/medicine-edit.component';
import { PaymentComponent } from './payment/payment.component';
import { ValidatorsService } from '../Services/validators.service';
import { PatientDetail } from '../Models/patientDetail.model';
import { Opd } from '../Models/opd.model';
import { MedicineService } from '../Services/medicine.service';
import { NotifyUpdateService } from '../Services/notify-update.service';
import { SupabaseDataService } from '../Services/supabase-data.service';
import { Subject } from 'rxjs';
import { UserLoginService } from '../Services/user-login.service';

describe('Patient form requirements', () => {
  const fb = new FormBuilder();
  let close: jasmine.Spy;
  const dialog = <T>(): MatDialogRef<T> => ({ close } as unknown as MatDialogRef<T>);

  beforeEach(() => close = jasmine.createSpy('close'));

  it('saves an operation patient with only a name, without collecting marital status', () => {
    const component = new PatientEditComponent(fb, new ValidatorsService(), dialog(), { firstName: '', maritalStatus: 'Married' } as PatientDetail);
    component.c.firstName.setValue('Ali Khan');
    expect(component.patientForm.valid).toBeTrue();
    expect(component.patientForm.get('patientDetail.familyStatus')).toBeNull();
    component.onSubmit();
    expect(close.calls.mostRecent().args[0].firstName).toBe('Ali Khan');
    expect(close.calls.mostRecent().args[0].maritalStatus).toBe('Married');
    component.d.age.setValue(-1);
    expect(component.patientForm.invalid).toBeTrue();
  });

  it('allows an OPD visit without phone, vitals, doctor or address and normalizes its MR number', () => {
    const component = new OpdEditComponent(fb, dialog(), {} as Opd);
    component.opdForm.patchValue({ patientName: '  Ali Khan  ' });
    expect(component.opdForm.valid).toBeTrue();
    component.onSubmit();
    const saved = close.calls.mostRecent().args[0];
    expect(saved.patientName).toBe('Ali Khan');
    expect(saved.patientId).toBe(0);
    expect(saved.amount).toBe(0);
    component.opdForm.get('amount')!.setValue(-10);
    expect(component.opdForm.invalid).toBeTrue();
  });

  it('allows an inpatient admission without a discharge date', () => {
    const component = new InpatientEditComponent(fb, dialog(), {});
    component.c.patientName.setValue('Ali Khan');
    expect(component.inpatientForm.valid).toBeTrue();
    component.onSubmit();
    expect(close.calls.mostRecent().args[0].dischargeDate).toBeNull();
  });

  it('requires the lab patient and tests but permits empty secondary details and Unicode names', () => {
    const component = new LabEditComponent(fb, dialog(), {});
    component.labPatientForm.patchValue({ name: 'علی خان', testName: ['CBC', 'Blood Group'], dateTime: '' });
    expect(component.labPatientForm.valid).toBeTrue();
    component.onSubmit();
    const saved = close.calls.mostRecent().args[0];
    expect(saved.testName).toBe('CBC, Blood Group');
    expect(saved.dateTime instanceof Date).toBeTrue();
    expect(Number.isNaN(saved.dateTime.getTime())).toBeFalse();
    component.c.testName.setValue([]);
    expect(component.labPatientForm.invalid).toBeTrue();
  });

  it('loads existing comma-separated lab tests into the multiple selection', () => {
    const component = new LabEditComponent(fb, dialog(), { patientId: 7, name: 'Ali', testName: 'CBC, Blood Group' });
    expect(component.c.testName.value).toEqual(['CBC', 'Blood Group']);
    component.onSubmit();
    expect(close.calls.mostRecent().args[0].patientId).toBe(7);
  });

  it('rejects whitespace names while leaving optional fields empty', () => {
    const component = new OpdEditComponent(fb, dialog(), {} as Opd);
    component.opdForm.get('patientName')!.setValue('   ');
    component.onSubmit();
    expect(close).not.toHaveBeenCalled();
    expect(component.opdForm.get('patientName')!.touched).toBeTrue();
  });

  it('saves medicine entries without room or doctor and prevents duplicate submits', async () => {
    let finish!: (value: boolean) => void;
    const service = jasmine.createSpyObj<MedicineService>('MedicineService', ['addNewMedicine']);
    service.addNewMedicine.and.returnValue(new Promise(resolve => finish = resolve));
    const component = new MedicineEditComponent(fb, service, dialog(), null, new NotifyUpdateService(), {} as MatDialog);
    component.ngOnInit();
    component.medicineForm.get('patientName')!.setValue('Ali');
    component.medicines.at(0).patchValue({ medicineName: 'Medicine A', quantity: 2 });
    expect(component.medicineForm.valid).toBeTrue();
    const saving = component.onSubmit();
    await component.onSubmit();
    expect(service.addNewMedicine).toHaveBeenCalledTimes(1);
    finish(true);
    await saving;
    expect(close).toHaveBeenCalledTimes(1);
    expect(component.saving).toBeFalse();
  });

  it('keeps medicine input available when persistence fails', async () => {
    const service = jasmine.createSpyObj<MedicineService>('MedicineService', ['addNewMedicine']);
    service.addNewMedicine.and.rejectWith(new Error('offline'));
    const component = new MedicineEditComponent(fb, service, dialog(), null, new NotifyUpdateService(), {} as MatDialog);
    component.ngOnInit();
    component.medicineForm.get('patientName')!.setValue('Ali');
    component.medicines.at(0).patchValue({ medicineName: 'Medicine A', quantity: 1 });
    await component.onSubmit();
    expect(close).not.toHaveBeenCalled();
    expect(component.saveError).toContain('Unable to save');
    expect(component.medicineForm.get('patientName')!.value).toBe('Ali');
  });

  it('requires payment attribution and recalculates change when the amount changes', async () => {
    const db = { getItem: () => Promise.resolve([]), changes: new Subject<string>() } as unknown as SupabaseDataService;
    const component = new PaymentComponent(fb, db, { getLoginUser: async () => 'admin', getStaffIdentity: async () => ({ id: 'forms-test-staff', name: 'Ayesha', email: 'ayesha@example.test' }) } as UserLoginService);
    await component.ngOnInit();
    component.paymentForm.patchValue({ patientName: 'Ali', amount: 100, shiftName: 'Morning' });
    expect(component.paymentForm.valid).toBeTrue();
    component.paymentForm.get('cashGiven')!.setValue(150);
    expect(component.cashReturn).toBe(50);
    component.paymentForm.get('amount')!.setValue(120);
    expect(component.cashReturn).toBe(30);
    component.ngOnDestroy();
  });
});
