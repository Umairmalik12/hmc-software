import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Medicine } from 'src/app/Models/medicine.model';
import { buildDailyMedicineReceipt, DAILY_MEDICINE_RECEIPT_CSS } from '../daily-medicine-receipt';
import { printThermal } from '../../patient-token/thermal-print';

@Component({
  selector: 'app-medicine-slip',
  templateUrl: './medicine-slip.component.html',
  styleUrls: ['./medicine-slip.component.css'],
  styles: [DAILY_MEDICINE_RECEIPT_CSS],
  encapsulation: ViewEncapsulation.None,
})
export class MedicineSlipComponent {
  readonly record: Medicine;
  readonly html: string;
  private readonly receiptHtml: string;
  paperWidth: 58 | 80 = 80;
  constructor(public dialogRef: MatDialogRef<MedicineSlipComponent>, @Inject(MAT_DIALOG_DATA) data: { record: Medicine }) {
    this.record = { ...data.record, medicines: (data.record.medicines || []).map(item => ({ ...item })) };
    this.receiptHtml = buildDailyMedicineReceipt(this.record);
    // Angular strips IDs from sanitized HTML. Preview styles use the receipt
    // class; the dedicated print document retains its ID for height measurement.
    this.html = this.receiptHtml.replace(' id="daily-medicine-receipt"', '');
    try { this.paperWidth = localStorage.getItem('hmc.dailyMedicinePaperWidth') === '58' ? 58 : 80; } catch { /* Keep the existing 80 mm roll default. */ }
  }
  print(): void {
    try { localStorage.setItem('hmc.dailyMedicinePaperWidth', String(this.paperWidth)); } catch { /* Use the current roll selection. */ }
    printThermal('<style>' + DAILY_MEDICINE_RECEIPT_CSS + '</style>' + this.receiptHtml, this.paperWidth, 'daily-medicine-receipt');
  }
  close(): void { this.dialogRef.close(); }
}
