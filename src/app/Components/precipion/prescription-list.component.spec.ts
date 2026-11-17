import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { PrescriptionListComponent } from './prescription-list.component';
import { PrescriptionService } from 'src/app/Services/prescription.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { emptyPrescription, PrescriptionRecord } from 'src/app/Models/prescription.model';

describe('Prescription records list', () => {
  let component: PrescriptionListComponent;
  let service: jasmine.SpyObj<PrescriptionService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  beforeEach(() => {
    service = jasmine.createSpyObj<PrescriptionService>('prescriptions', ['getAll', 'delete']);
    service.getAll.and.resolveTo([]);
    service.delete.and.resolveTo();
    dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']);
    component = new PrescriptionListComponent(service, { changes: new Subject<string>() } as SupabaseDataService, dialog);
    component.records = Array.from({ length: 45 }, (_, index) => {
      const record = { ...emptyPrescription(), id: String(index) };
      record.patient.name = index ? 'Patient ' + index : 'Ali Khan';
      record.patient.refId = 'MR-' + index;
      record.medicines[0].name = index ? 'Medicine B' : 'MIXEL';
      return record;
    });
  });
  afterEach(() => component.ngOnDestroy());

  it('searches patient, MR number and medicines and paginates the filtered results', () => {
    expect(component.visibleRecords.length).toBe(20);
    component.loadMore();
    expect(component.visibleRecords.length).toBe(40);
    component.loadMore();
    expect(component.visibleRecords.length).toBe(45);
    for (const query of ['ali', 'mr-0', 'mixel']) {
      component.query = query;
      component.onSearch();
      expect(component.visibleRecords.map(record => record.id)).toEqual(['0']);
    }
  });

  it('passes a detached record into the preview modal without modifying the saved data', () => {
    const original = component.records[0];
    component.preview(original);
    const record = (dialog.open.calls.mostRecent().args[1]!.data as { record: PrescriptionRecord }).record;
    record.medicines[0].name = 'Changed';
    expect(original.medicines[0].name).toBe('MIXEL');
  });

  it('deletes after confirmation and removes only that row', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    await component.delete(component.records[0]);
    expect(service.delete).toHaveBeenCalledWith('0');
    expect(component.records.length).toBe(44);
  });

  it('leaves records visible if deletion fails or is cancelled', async () => {
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    await component.delete(component.records[0]);
    expect(service.delete).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    service.delete.and.rejectWith(new Error('permission denied'));
    await component.delete(component.records[0]);
    expect(component.records.length).toBe(45);
    expect(component.errorMessage).toBe('permission denied');
  });
});
