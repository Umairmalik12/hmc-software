import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { printThermal } from '../patient-token/thermal-print';
import { PaymentRecord } from './payment-record';
import { buildPaymentReceipt } from './payment-receipt';

@Component({
  selector: 'app-payment-slip-preview',
  templateUrl: './payment-slip-preview.component.html',
  styleUrls: ['./payment-slip-preview.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PaymentSlipPreviewComponent {
  readonly record: PaymentRecord;
  readonly html: string;
  paperWidth: 58 | 80 = 58;
  constructor(private ref: MatDialogRef<PaymentSlipPreviewComponent>, @Inject(MAT_DIALOG_DATA) data: { record: PaymentRecord; paperWidth?: 58 | 80 }, private feedback: NotifyUpdateService = new NotifyUpdateService()) {
    this.record = { ...data.record }; this.html = buildPaymentReceipt(this.record);
    try { this.paperWidth = localStorage.getItem('hmc.paymentPaperWidth') === '80' ? 80 : 58; } catch { /* Keep the existing 58 mm payment default. */ }
    if (data.paperWidth === 58 || data.paperWidth === 80) this.paperWidth = data.paperWidth;
  }
  changePaperWidth(width: 58 | 80): void {
    this.paperWidth = width === 80 ? 80 : 58;
    try { localStorage.setItem('hmc.paymentPaperWidth', String(this.paperWidth)); } catch { /* Keep the choice in the current preview. */ }
  }
  print(): void { this.changePaperWidth(this.paperWidth); printThermal(this.html, this.paperWidth, 'payment-receipt', this.feedback); }
  close(): void { this.ref.close(); }
}
