import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OtMedicineRecord, copyOtRecord } from 'src/app/Models/ot-medicine.model';
import { buildOtMedicineDocument, OT_DOCUMENT_CSS, printOtMedicine } from './ot-medicine-document';

@Component({
  selector: 'app-ot-medicine-preview',
  template: `<h2 mat-dialog-title>OT medicine preview</h2><mat-dialog-content><div class="ot-preview-paper" [innerHTML]="html"></div></mat-dialog-content><p *ngIf="error" class="form-error" role="alert">{{ error }}</p><mat-dialog-actions><button mat-stroked-button mat-dialog-close>Close</button><button mat-flat-button color="primary" (click)="print()"><mat-icon>print</mat-icon>Print</button></mat-dialog-actions>`,
  styles: [OT_DOCUMENT_CSS, '.ot-preview-paper{min-width:190mm;padding:18px;background:#fff}.ot-preview-panel .mat-mdc-dialog-surface{display:flex;flex-direction:column;max-height:90dvh;overflow:hidden}.ot-preview-panel app-ot-medicine-preview{display:flex;flex-direction:column;min-height:0;max-height:90dvh}.ot-preview-panel mat-dialog-content{min-height:0;max-height:none;overflow:auto;background:#eef2f5}.ot-preview-panel mat-dialog-actions{flex-shrink:0;justify-content:flex-end;padding:16px;gap:8px}'],
  encapsulation: ViewEncapsulation.None,
})
export class OtMedicinePreviewComponent {
  record: OtMedicineRecord;
  html: string;
  error = '';
  constructor(@Inject(MAT_DIALOG_DATA) data: { record: OtMedicineRecord }, private feedback: NotifyUpdateService = new NotifyUpdateService()) { this.record = copyOtRecord(data.record); this.html = buildOtMedicineDocument(this.record); }
  print(): void {
    this.error = printOtMedicine(this.record) ? '' : 'Allow pop-ups to print this OT record.';
    if (this.error) this.feedback.error(this.error);
    else this.feedback.info('OT medicine record prepared for printing.', { title: 'Print requested', route: '/ot-records' });
  }
}
