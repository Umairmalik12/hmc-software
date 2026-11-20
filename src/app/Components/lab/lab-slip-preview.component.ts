import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LabPatient } from 'src/app/Models/lab.model';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { printThermal } from '../patient-token/thermal-print';
import { buildLabReceipt } from './lab-thermal-receipt';

@Component({
  selector: 'app-lab-slip-preview',
  templateUrl: './lab-slip-preview.component.html',
  styleUrls: ['./lab-slip-preview.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class LabSlipPreviewComponent {
  readonly record: LabPatient;
  readonly html: string;
  paperWidth: 58 | 80 = 80;
  constructor(private ref: MatDialogRef<LabSlipPreviewComponent>, @Inject(MAT_DIALOG_DATA) data: { record: LabPatient }, private feedback: NotifyUpdateService = new NotifyUpdateService()) {
    this.record = { ...data.record,
      testName: Array.isArray(data.record.testName) ? data.record.testName.join(', ') : data.record.testName,
      dateTime: data.record.dateTime ? new Date(data.record.dateTime) : data.record.dateTime };
    this.html = buildLabReceipt(this.record);
    try { this.paperWidth = localStorage.getItem('hmc.labPaperWidth') === '58' ? 58 : 80; } catch { /* Keep the existing 80 mm laboratory default. */ }
  }
  changePaperWidth(width: 58 | 80): void {
    this.paperWidth = width === 58 ? 58 : 80;
    try { localStorage.setItem('hmc.labPaperWidth', String(this.paperWidth)); } catch { /* Keep the choice for this preview when storage is unavailable. */ }
  }
  print(): void { this.changePaperWidth(this.paperWidth); printThermal(this.html, this.paperWidth, 'lab-slip-print', this.feedback); }
  close(): void { this.ref.close(); }
}
