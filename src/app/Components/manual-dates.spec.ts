import { FormBuilder, FormControl } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PatientEditComponent } from './patient/patient-edit/patient-edit.component';
import { OpdEditComponent } from './opdslip/opd-edit/opd-edit.component';
import { InpatientEditComponent } from './inpatient/inpatient-edit/inpatient-edit.component';
import { LabEditComponent } from './lab/lab-edit/lab-edit.component';
import { MedicineEditComponent } from './medicine/medicine-edit/medicine-edit.component';
import { PatientDetail } from '../Models/patientDetail.model';
import { Opd } from '../Models/opd.model';
import { emptyOtRecord } from '../Models/ot-medicine.model';
import { emptyPrescription } from '../Models/prescription.model';
import { Medicine } from '../Models/medicine.model';
import { MedicineService } from '../Services/medicine.service';
import { PatientService } from '../Services/patient.service';
import { OpdService } from '../Services/opd.service';
import { InpatientService } from '../Services/inpatient.service';
import { NotifyUpdateService } from '../Services/notify-update.service';
import { ValidatorsService } from '../Services/validators.service';
import { selectedDateTime, validSelectedDateTime } from '../Shared/date-time-values';
import { memoryDb } from '../testing/memory-db';
import { buildLabReceipt } from './lab/lab-thermal-receipt';
import { buildOpdThermalReceipt } from './opdslip/opd-slip/opd-thermal-receipt';

describe('Manually selected business dates', () => {
  const fb = new FormBuilder();
  const chosen = '2020-01-02T00:05';
  const expected = new Date(chosen).toISOString();
  let close: jasmine.Spy;
  let ref: MatDialogRef<any>;
  let store: ReturnType<typeof memoryDb>;
  beforeEach(() => { close = jasmine.createSpy('close'); ref = { close } as unknown as MatDialogRef<any>; store = memoryDb(); });

  it('starts all registration and slip dates empty without inventing the current date', () => {
    const operation = new PatientEditComponent(fb, new ValidatorsService(), ref, {} as PatientDetail);
    const opd = new OpdEditComponent(fb, ref, {} as Opd);
    const inpatient = new InpatientEditComponent(fb, ref, {});
    const lab = new LabEditComponent(fb, ref, {});
    const medicine = new MedicineEditComponent(fb, new MedicineService(store.db), ref, null, new NotifyUpdateService(), {} as MatDialog); medicine.ngOnInit();
    expect(operation.b.createdAt.value).toBe(''); expect(opd.opdForm.get('createdAt')!.value).toBe('');
    expect(inpatient.f.value).toBe(''); expect(lab.c.dateTime.value).toBe('');
    expect(medicine.f.get('createdAt')!.value).toBe(''); expect(medicine.f.get('createdAt')!.enabled).toBeTrue();
    expect(emptyOtRecord().operationDate).toBe(''); expect(emptyOtRecord().operationTime).toBe(''); expect(emptyPrescription().issuedAt).toBe('');
  });

  it('persists the chosen operation and inpatient registration times and leaves optional empty dates empty', async () => {
    const operation = new PatientEditComponent(fb, new ValidatorsService(), ref, {} as PatientDetail);
    operation.b.patientId.setValue(600); operation.c.firstName.setValue('Ali'); operation.b.createdAt.setValue(chosen); operation.onSubmit();
    const patient = close.calls.mostRecent().args[0]; expect(patient.createdAt).toBe(expected);
    expect(await new PatientService(store.db).addNewPatient(patient)).toBeTrue();
    expect((await store.db.getItem<PatientDetail[]>('patientDetails'))![0].createdAt).toBe(expected);
    const admission = new InpatientEditComponent(fb, ref, {}); admission.b.inpatientId.setValue(700); admission.c.patientName.setValue('Ali'); admission.f.setValue(chosen); admission.onSubmit();
    const inpatient = close.calls.mostRecent().args[0]; expect(inpatient.createdAt).toBe(expected);
    expect(await new InpatientService(store.db).addNewInpatient(inpatient)).toBeTrue();
    expect((await store.db.getItem<any[]>('inpatientDetails'))![0].createdAt).toBe(expected);
    patient.patientId = 601; patient.createdAt = ''; expect(await new PatientService(store.db).addNewPatient(patient)).toBeTrue();
    expect((await store.db.getItem<PatientDetail[]>('patientDetails'))!.find(row => row.patientId === 601)!.createdAt).toBe('');
  });

  it('uses the chosen OPD registration date and time on both the stored record and receipt', async () => {
    const editor = new OpdEditComponent(fb, ref, {} as Opd);
    editor.opdForm.patchValue({ patientId: 800, patientName: 'Ali', createdAt: chosen }); editor.onSubmit();
    const saved = close.calls.mostRecent().args[0];
    expect(saved.createdAt).toBe(expected); expect(saved.date).toBe('2020-01-02'); expect(saved.time).toBe('00:05');
    expect(await new OpdService(store.db).addNewOpd(saved)).toBeTrue();
    const html = buildOpdThermalReceipt(saved); expect(html).toContain('02/01/2020'); expect(html).toContain('12:05 AM');
  });

  it('saves a chosen daily medicine date and preserves it when reopening and editing', async () => {
    const service = new MedicineService(store.db);
    const editor = new MedicineEditComponent(fb, service, ref, null, new NotifyUpdateService(), {} as MatDialog); editor.ngOnInit();
    editor.f.patchValue({ patientName: 'Ali', createdAt: chosen }); editor.medicines.at(0).patchValue({ medicineName: '2SUM 1g', quantity: 2 }); await editor.onSubmit();
    const saved: Medicine = close.calls.mostRecent().args[0]; expect(saved.createdAt).toBe(expected);
    const editing = new MedicineEditComponent(fb, service, ref, { medicines: [saved] }, new NotifyUpdateService(), {} as MatDialog); editing.ngOnInit();
    expect(editing.f.get('createdAt')!.value).toBe(expected); editing.f.patchValue({ patientName: 'Updated Ali' }); await editing.onSubmit();
    expect(close.calls.mostRecent().args[0].createdAt).toBe(expected);
  });

  it('uses the selected lab date for receipts and never prints today for undated records', () => {
    const editor = new LabEditComponent(fb, ref, {});
    editor.labPatientForm.patchValue({ name: 'Ali', testName: ['CBC'], dateTime: chosen }); editor.onSubmit();
    const saved = close.calls.mostRecent().args[0]; expect(saved.dateTime).toBe(expected);
    expect(buildLabReceipt(saved)).toContain('02/01/2020');
    expect(buildLabReceipt({ ...saved, dateTime: '' })).toContain('Not recorded');
    expect(buildLabReceipt({ ...saved, dateTime: 'invalid' })).toContain('Not recorded');
  });

  it('preserves existing timestamps exactly and rejects invalid manual dates', () => {
    const existing = '2020-01-01T19:05:17Z';
    const editor = new PatientEditComponent(fb, new ValidatorsService(), ref, { patientId: 600, firstName: 'Ali', createdAt: existing } as PatientDetail);
    expect(editor.b.createdAt.value).toBe(existing); editor.onSubmit(); expect(close.calls.mostRecent().args[0].createdAt).toBe(existing);
    for (const value of ['2020-02-30T12:00', '2020-01-01T25:00', 'invalid', '2020-01-01']) expect(validSelectedDateTime(new FormControl(value))).not.toBeNull();
    expect(selectedDateTime('')).toBe(''); expect(validSelectedDateTime(new FormControl(''))).toBeNull(); expect(selectedDateTime(chosen)).toBe(expected);
  });
});
