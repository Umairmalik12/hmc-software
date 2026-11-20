import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { LabPatient } from '../../Models/lab.model';
import { LabService } from '../../Services/lab.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { LabListComponent } from './lab-list/lab-list.component';
import { LabSlipPreviewComponent } from './lab-slip-preview.component';

describe('Laboratory print preview selection', () => {
  const record: LabPatient = { patientId: 12, name: 'Ali', phone: '', testName: 'CBC, LFTs', price: 100, suggestedDr: 'Dr Haq', dateTime: new Date('2026-11-20T08:30:00Z') };

  it('opens a modal with the latest saved record before requesting the printer', async () => {
    const service = jasmine.createSpyObj<LabService>('lab', ['getLabPatientDetails']); service.getLabPatientDetails.and.returnValue(of({ ...record, price: 250 }));
    const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const feedback = new NotifyUpdateService();
    const list = new LabListComponent(service, dialog, {} as any, {} as any, {} as any, feedback);
    const popup = spyOn(window, 'open');
    try {
      list.patient = [record]; await list.printLabSlip(12);
      expect(service.getLabPatientDetails).toHaveBeenCalledWith(12); expect(popup).not.toHaveBeenCalled();
      expect(dialog.open).toHaveBeenCalledWith(LabSlipPreviewComponent, jasmine.objectContaining({ width: '480px', panelClass: 'hmc-dialog-panel', data: { record: jasmine.objectContaining({ patientId: 12, price: 250 }) } }));
      (dialog.open.calls.mostRecent().args[1]!.data as any).record.name = 'Changed in preview'; expect(record.name).toBe('Ali');
    } finally { list.ngOnDestroy(); feedback.ngOnDestroy(); }
  });

  it('reports failed or missing records without opening another patient slip', async () => {
    const service = jasmine.createSpyObj<LabService>('lab', ['getLabPatientDetails']);
    const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const feedback = new NotifyUpdateService(); const errors = spyOn(feedback, 'error');
    const list = new LabListComponent(service, dialog, {} as any, {} as any, {} as any, feedback);
    try {
      list.patient = [record]; service.getLabPatientDetails.and.returnValue(of(undefined as any)); await list.printLabSlip(12);
      service.getLabPatientDetails.and.returnValue(throwError(() => new Error('Offline'))); await list.printLabSlip(12);
      expect(dialog.open).not.toHaveBeenCalled(); expect(errors).toHaveBeenCalledTimes(2);
    } finally { list.ngOnDestroy(); feedback.ngOnDestroy(); }
  });

  it('keeps the paper choice when storage is blocked and reports a blocked print popup', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('Storage blocked'); spyOn(Storage.prototype, 'setItem').and.throwError('Storage blocked');
    const feedback = new NotifyUpdateService(); const error = spyOn(feedback, 'error'); const close = jasmine.createSpy('close');
    const modal = new LabSlipPreviewComponent({ close } as unknown as MatDialogRef<LabSlipPreviewComponent>, { record }, feedback);
    try {
      expect(modal.paperWidth).toBe(80); modal.changePaperWidth(58); expect(modal.paperWidth).toBe(58);
      spyOn(window, 'open').and.returnValue(null); modal.print(); expect(error).toHaveBeenCalledWith('Allow pop-ups for this site to print the receipt.');
      expect(modal.paperWidth).toBe(58); modal.close(); expect(close).toHaveBeenCalled();
    } finally { feedback.ngOnDestroy(); }
  });
});
