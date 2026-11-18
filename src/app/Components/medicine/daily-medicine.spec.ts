import { FormBuilder } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Medicine } from 'src/app/Models/medicine.model';
import { MedicineService } from 'src/app/Services/medicine.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { memoryDb } from 'src/app/testing/memory-db';
import { MedicineEditComponent } from './medicine-edit/medicine-edit.component';
import { MedicineListComponent } from './medicine-list/medicine-list.component';
import { MedicineSlipComponent } from './medicine-slip/medicine-slip.component';
import { buildDailyMedicineReceipt } from './daily-medicine-receipt';

describe('Daily medicine record, room and thermal receipt', () => {
  const record: Medicine = { medicineId: 42, patientName: 'Ali', roomNo: 'GW Bed 1', doctorName: 'Dr Haq', createdAt: '2026-11-17T06:30:00Z', medicines: [{ medicineName: 'Medicine A', quantity: 2 }] };

  it('creates, edits and deletes the medicine record with its selected room and original timestamp', async () => {
    const { db } = memoryDb(); const service = new MedicineService(db); const close = jasmine.createSpy('close');
    const feedback = new NotifyUpdateService(); const messages: Array<{ msg: string; type: string }> = [];
    feedback.alertNotify.subscribe(message => messages.push(message));
    const dialog = { close } as unknown as MatDialogRef<MedicineEditComponent>;
    const add = new MedicineEditComponent(new FormBuilder(), service, dialog, null, feedback, {} as MatDialog); add.ngOnInit();
    add.medicineForm.patchValue({ patientName: 'Ali', roomNo: 'GW Bed 1' }); add.medicines.at(0).patchValue({ medicineName: 'Medicine A', quantity: 2 });
    await add.onSubmit(); const saved: Medicine = close.calls.mostRecent().args[0];
    expect(saved.roomNo).toBe('GW Bed 1');
    const edit = new MedicineEditComponent(new FormBuilder(), service, dialog, { medicines: [saved] }, feedback, {} as MatDialog); edit.ngOnInit();
    edit.medicineForm.patchValue({ roomNo: 'Room 2' }); edit.medicines.at(0).get('quantity')!.setValue(4); await edit.onSubmit();
    const updated = (await firstValueFrom(service.getMedicineDetails(saved.medicineId)))!;
    expect(updated.roomNo).toBe('Room 2'); expect(updated.createdAt).toBe(saved.createdAt); expect(updated.medicines[0].quantity).toBe(4);
    expect(await service.deleteMedicine(saved.medicineId)).toBeTrue(); expect(await firstValueFrom(service.getMedicineDetails(saved.medicineId))).toBeUndefined();
    expect(db.setItem).not.toHaveBeenCalled();
    expect(messages.map(message => message.msg)).toEqual(['Daily medicine record saved successfully.', 'Daily medicine record updated successfully.']);
    expect(messages.every(message => message.type === 'success')).toBeTrue(); feedback.ngOnDestroy();
  });

  it('prints only the selected record, without combining other records for the same patient name', async () => {
    const service = jasmine.createSpyObj<MedicineService>('medicine', ['getMedicineDetails', 'getAllMedicine']);
    service.getMedicineDetails.and.returnValue(of(record));
    service.getAllMedicine.and.returnValue(of([record, { ...record, medicineId: 43, roomNo: 'Room 2', medicines: [{ medicineName: 'Other day medicine', quantity: 5 }] }]));
    const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const dependency: any = new NotifyUpdateService();
    const list = new MedicineListComponent(service, dialog, dependency, dependency, dependency, dependency, dependency);
    await list.printSlip(42);
    expect(service.getAllMedicine).not.toHaveBeenCalled(); expect(service.getMedicineDetails).toHaveBeenCalledWith(42);
    expect(dialog.open.calls.mostRecent().args[0]).toBe(MedicineSlipComponent);
    expect((dialog.open.calls.mostRecent().args[1]!.data as any).record.roomNo).toBe('GW Bed 1');
    const html = buildDailyMedicineReceipt((dialog.open.calls.mostRecent().args[1]!.data as any).record);
    expect(html).toContain('GW Bed 1'); expect(html).not.toContain('Other day medicine');
    list.ngOnDestroy();
  });

  it('reports missing or failed receipt reads without opening an empty modal', async () => {
    const service = jasmine.createSpyObj<MedicineService>('medicine', ['getMedicineDetails']);
    const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const dependency: any = new NotifyUpdateService();
    const alert = jasmine.createSpy('alert'); dependency.alertNotify.subscribe(alert);
    const list = new MedicineListComponent(service, dialog, dependency, dependency, dependency, dependency, dependency);
    service.getMedicineDetails.and.returnValue(of(undefined)); await list.printSlip(42);
    service.getMedicineDetails.and.returnValue(throwError(() => new Error('offline'))); await list.printSlip(42);
    expect(dialog.open).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalledTimes(2); list.ngOnDestroy();
  });

  it('escapes patient, room and medicine text and keeps preview data separate from the saved record', () => {
    const source = { ...record, roomNo: 'Room <b>1</b>', patientName: 'Ali <script>alert(1)</script>', medicines: [{ medicineName: 'A & B <i>tablets</i>', quantity: 2 }] };
    const preview = new MedicineSlipComponent({ close: () => {} } as MatDialogRef<MedicineSlipComponent>, { record: source });
    source.medicines[0].medicineName = 'Changed later';
    expect(preview.record.medicines[0].medicineName).toBe('A & B <i>tablets</i>');
    const container = document.createElement('div'); container.innerHTML = preview.html;
    expect(container.querySelector('script,b,i')).toBeNull(); expect(container.textContent).toContain('Room <b>1</b>'); expect(container.textContent).toContain('THANK YOU!');
  });

  it('numbers medicine lines without changing their order, quantities or saved patient details', () => {
    const source = { ...record, medicines: [{ medicineName: 'A long medicine name with package description', quantity: 12 }, { medicineName: 'Medicine B', quantity: 3 }] };
    const before = JSON.stringify(source), receipt = document.createElement('div'); receipt.innerHTML = buildDailyMedicineReceipt(source);
    expect(receipt.querySelector('.medicine-patient-block .patient-row .slip-value')!.textContent).toBe('Ali');
    expect(receipt.querySelector('.medicine-patient-block .room-row .slip-value')!.textContent).toBe('GW Bed 1');
    const rows = Array.from(receipt.querySelectorAll('.medicine-line:not(.medicine-heading)'));
    expect(rows.map(row => row.querySelector('.medicine-index')!.textContent)).toEqual(['1', '2']);
    expect(rows.map(row => row.querySelector('.medicine-name')!.textContent)).toEqual(source.medicines.map(item => item.medicineName));
    expect(rows.map(row => row.querySelector('.medicine-quantity')!.textContent)).toEqual(['12', '3']);
    expect(receipt.querySelector('.items-total .slip-value')!.textContent).toBe('2'); expect(JSON.stringify(source)).toBe(before);
  });
});
