import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';
import { PreciptionComponent } from './precipion.component';
import { PrescriptionService } from 'src/app/Services/prescription.service';
import { emptyPrescription, PrescriptionRecord } from 'src/app/Models/prescription.model';
import { SimpleChange } from '@angular/core';

describe('Prescription editor workflow', () => {
  let component: PreciptionComponent;
  let service: jasmine.SpyObj<PrescriptionService>;
  let router: jasmine.SpyObj<Router>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    service = jasmine.createSpyObj<PrescriptionService>('prescriptions', ['getById', 'save']);
    router = jasmine.createSpyObj<Router>('router', ['navigate']);
    router.navigate.and.resolveTo(true);
    dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']);
    params = new BehaviorSubject(convertToParamMap({}));
    component = new PreciptionComponent(service, { paramMap: params } as unknown as ActivatedRoute, router, dialog);
  });
  afterEach(() => component.ngOnDestroy());

  it('starts undated and never changes the selected date/time as the clock advances', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 17, 13, 35));
    try {
      component.ngOnInit();
      expect(component.record.issuedAt).toBe('');
      component.record.issuedAt = '2025-01-01T13:35';
      jasmine.clock().tick(60000);
      expect(component.record.issuedAt).toBe('2025-01-01T13:35');
    } finally { jasmine.clock().uninstall(); }
  });

  it('does not persist when adding/removing rows or previewing a draft', () => {
    component.loading = false;
    component.record.patient.name = 'Ali';
    component.addMedicine();
    component.removeMedicine(1);
    component.preview();
    const snapshot = (dialog.open.calls.mostRecent().args[1]!.data as { record: PrescriptionRecord }).record;
    snapshot.patient.name = 'Changed preview';
    expect(component.record.patient.name).toBe('Ali');
    expect(service.save).not.toHaveBeenCalled();
  });

  it('opens medicine management without leaving or modifying the prescription draft', () => {
    component.record.patient.name = 'Ali'; component.record.medicines[0].name = 'Saved medicine / dose';
    const before = JSON.stringify(component.record);
    component.manageMedicines();
    expect((dialog.open.calls.mostRecent().args[1]!.data as any).embedded).toBeTrue();
    expect(JSON.stringify(component.record)).toBe(before); expect(router.navigate).not.toHaveBeenCalled(); expect(service.save).not.toHaveBeenCalled();
  });

  it('saves once and returns to the prescription list after the write succeeds', async () => {
    component.loading = false;
    component.record.patient.name = 'Ali';
    let finish!: (value: ReturnType<typeof emptyPrescription>) => void;
    service.save.and.returnValue(new Promise(resolve => finish = resolve));
    const saving = component.save();
    await component.save();
    expect(service.save).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
    finish({ ...component.record, id: '9' });
    expect(await saving).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/prescriptions']);
  });

  it('keeps the draft and displays the database failure without navigating away', async () => {
    component.loading = false;
    component.record.patient.name = 'Ali';
    service.save.and.rejectWith(new Error('permission denied'));
    expect(await component.save()).toBeFalse();
    expect(component.storageError).toBe('permission denied');
    expect(component.record.patient.name).toBe('Ali');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('loads an existing record for editing with its original issue timestamp', async () => {
    const record = { ...emptyPrescription(), id: '12', issuedAt: '2026-01-01T03:04:00Z' };
    service.getById.and.resolveTo(record);
    params.next(convertToParamMap({ prescriptionId: '12' }));
    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();
    expect(component.record.issuedAt).toBe(record.issuedAt);
    expect(service.getById).toHaveBeenCalledWith('12');
    expect(component.record).not.toBe(record);
  });
  it('uses the workspace ID even when the nested editor receives an empty route, and reloads when it changes', async () => {
    const one = { ...emptyPrescription(), id: '12' }, two = { ...emptyPrescription(), id: '13' };
    one.patient.name = 'First'; two.patient.name = 'Second';
    service.getById.and.callFake(async id => id === '12' ? one : two);
    component.prescriptionId = '12'; component.ngOnInit(); await Promise.resolve(); await Promise.resolve();
    expect(component.isEditing).toBeTrue(); expect(component.record.patient.name).toBe('First');
    component.prescriptionId = '13'; component.ngOnChanges({ prescriptionId: new SimpleChange('12', '13', false) }); await Promise.resolve(); await Promise.resolve();
    expect(component.record.patient.name).toBe('Second');
    component.prescriptionId = null; component.ngOnChanges({ prescriptionId: new SimpleChange('13', null, false) });
    expect(component.isEditing).toBeFalse(); expect(component.record.patient.name).toBe(''); expect(component.record.medicines.length).toBe(1);
  });
});
