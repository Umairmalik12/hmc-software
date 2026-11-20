import { FormBuilder } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { memoryDb } from '../../testing/memory-db';
import { PaymentComponent } from './payment.component';
import { PaymentRecord } from './payment-record';
import { PaymentSlipPreviewComponent } from './payment-slip-preview.component';

describe('Payment receipt modal', () => {
  const record: PaymentRecord = { id: '12', patientName: 'Ali', amount: 100, paymentMethod: 'cash', paymentStatus: 'completed', cashGiven: 100, cashReturn: 0, staffName: 'Ayesha', shiftName: 'Night', shiftDate: '2026-11-20', createdAt: '2026-11-20T08:30:00Z' };
  let previousPaper: string | null;
  beforeEach(() => previousPaper = localStorage.getItem('hmc.paymentPaperWidth'));
  afterEach(() => { if (previousPaper === null) localStorage.removeItem('hmc.paymentPaperWidth'); else localStorage.setItem('hmc.paymentPaperWidth', previousPaper); });

  it('loads the latest saved payment into a modal and updates the page paper choice before any printer popup', async () => {
    const { db, collections } = memoryDb(); collections.set('payments', new Map([['12', { ...record, amount: 250 }]]));
    localStorage.setItem('hmc.paymentPaperWidth', '58');
    const feedback = new NotifyUpdateService(); const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']);
    const closing = new Subject<void>(); let modal!: PaymentSlipPreviewComponent;
    dialog.open.and.callFake((component: any, config: any): any => {
      expect(component).toBe(PaymentSlipPreviewComponent);
      modal = new PaymentSlipPreviewComponent({ close: () => {} } as any, config.data, feedback);
      return { componentInstance: modal, beforeClosed: () => closing };
    });
    const page = new PaymentComponent(new FormBuilder(), db, {} as any, feedback, dialog); page.paperWidth = 80;
    const popup = spyOn(window, 'open');
    try {
      await page.showReceipt(record);
      expect(popup).not.toHaveBeenCalled(); expect(modal.paperWidth).toBe(80); expect(modal.record.amount).toBe(250);
      expect(dialog.open).toHaveBeenCalledWith(PaymentSlipPreviewComponent, jasmine.objectContaining({ width: '480px', panelClass: 'hmc-dialog-panel' }));
      modal.changePaperWidth(58); closing.next();
      expect<58 | 80>(page.paperWidth).toBe(58); expect(localStorage.getItem('hmc.paymentPaperWidth')).toBe('58');
      expect(collections.get('payments')!.get('12').amount).toBe(250); expect(db.upsertRecord).not.toHaveBeenCalled();
    } finally { page.ngOnDestroy(); feedback.ngOnDestroy(); }
  });

  it('reports missing or failed reads without opening a stale cached payment', async () => {
    const { db } = memoryDb(); const dialog = jasmine.createSpyObj<MatDialog>('dialog', ['open']); const feedback = new NotifyUpdateService(); const error = spyOn(feedback, 'error');
    const page = new PaymentComponent(new FormBuilder(), db, {} as any, feedback, dialog); page.payments = [record];
    try {
      await page.showReceipt(record); (db.getItem as jasmine.Spy).and.rejectWith(new Error('Offline')); await page.showReceipt(record);
      expect(dialog.open).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledTimes(2); expect(page.errorMessage).toBe('Offline');
    } finally { page.ngOnDestroy(); feedback.ngOnDestroy(); }
  });

  it('honours paper selections when storage is blocked and reports a blocked printer popup', () => {
    const get = spyOn(Storage.prototype, 'getItem').and.throwError('Storage blocked'); const set = spyOn(Storage.prototype, 'setItem').and.throwError('Storage blocked');
    const feedback = new NotifyUpdateService(); const error = spyOn(feedback, 'error'); const close = jasmine.createSpy('close');
    const modal = new PaymentSlipPreviewComponent({ close } as unknown as MatDialogRef<PaymentSlipPreviewComponent>, { record, paperWidth: 80 }, feedback);
    try {
      expect(modal.paperWidth).toBe(80); modal.changePaperWidth(58); expect(modal.paperWidth).toBe(58);
      spyOn(window, 'open').and.returnValue(null); modal.print(); expect(error).toHaveBeenCalledWith('Allow pop-ups for this site to print the receipt.');
      expect(modal.paperWidth).toBe(58); modal.close(); expect(close).toHaveBeenCalled();
    } finally { get.and.callThrough(); set.and.callThrough(); feedback.ngOnDestroy(); }
  });
});
