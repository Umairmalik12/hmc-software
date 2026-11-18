import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { buildPatientTokenReceipt } from './patient-token-receipt';
import { printThermal } from './thermal-print';

@Component({
  selector: 'app-patient-token-preview',
  template: `<h2 mat-dialog-title><mat-icon>receipt_long</mat-icon><span>Patient token {{ record.tokenNumber }}<small>Thermal print preview</small></span></h2>
    <mat-dialog-content class="token-preview-content"><app-thermal-receipt-preview [html]="html" [paperWidth]="paperWidth"></app-thermal-receipt-preview></mat-dialog-content>
    <mat-dialog-actions class="token-preview-actions"><label>Paper <select [ngModel]="paperWidth" (ngModelChange)="changePaperWidth($event)" aria-label="Patient token paper size"><option [ngValue]="58">58 mm</option><option [ngValue]="80">80 mm</option></select></label><button mat-stroked-button type="button" (click)="close()">Close</button><button mat-flat-button color="primary" type="button" (click)="print()"><mat-icon>print</mat-icon>Print token</button></mat-dialog-actions>`,
  styleUrls: ['./patient-token-preview.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PatientTokenPreviewComponent {
  readonly record: PatientTokenSlip;
  readonly html: string;
  paperWidth: 58 | 80 = 58;
  constructor(private ref: MatDialogRef<PatientTokenPreviewComponent>, @Inject(MAT_DIALOG_DATA) data: { record: PatientTokenSlip; paperWidth?: 58 | 80 }) {
    this.record = { ...data.record }; this.html = buildPatientTokenReceipt(this.record);
    try { this.paperWidth = localStorage.getItem('hmc.tokenPaperWidth') === '80' ? 80 : 58; } catch { /* Keep the existing 58 mm default. */ }
    if (data.paperWidth === 58 || data.paperWidth === 80) this.paperWidth = data.paperWidth;
  }
  changePaperWidth(width: 58 | 80): void {
    this.paperWidth = width === 80 ? 80 : 58;
    try { localStorage.setItem('hmc.tokenPaperWidth', String(this.paperWidth)); } catch { /* Keep the selection for this preview. */ }
  }
  print(): void { this.changePaperWidth(this.paperWidth); printThermal(this.html, this.paperWidth); }
  close(): void { this.ref.close(); }
}
