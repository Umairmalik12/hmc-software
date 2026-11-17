import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrescriptionRecord, copyPrescription } from 'src/app/Models/prescription.model';
import { printPrescription } from './prescription-print';

@Component({
  selector: 'app-prescription-preview',
  template: `<section class="rx-preview-dialog">
    <header class="rx-preview-toolbar"><div><h2 mat-dialog-title>Prescription preview</h2><p>{{ record.patient.name || 'Unsaved prescription' }}</p></div>
      <button mat-icon-button mat-dialog-close aria-label="Close prescription preview" title="Close"><mat-icon>close</mat-icon></button></header>
    <mat-dialog-content class="rx-preview-content"><app-prescription-document [record]="record"></app-prescription-document></mat-dialog-content>
    <p class="rx-preview-error" *ngIf="errorMessage" role="alert">{{ errorMessage }}</p>
    <mat-dialog-actions class="rx-preview-actions"><span>A4 · One page</span><button mat-stroked-button mat-dialog-close>Close</button><button mat-flat-button color="primary" (click)="print()"><mat-icon>print</mat-icon>Print</button></mat-dialog-actions>
  </section>`,
  styles: [`.prescription-preview-panel .mat-mdc-dialog-surface{overflow:hidden!important;border-radius:14px!important}
    .rx-preview-dialog{display:flex;flex-direction:column;max-height:90dvh;min-height:0}
    .rx-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;padding:16px 22px;border-bottom:1px solid #e1e9ed}
    .rx-preview-toolbar h2{margin:0;padding:0;font-size:18px;line-height:1.4}.rx-preview-toolbar h2:before{display:none}
    .rx-preview-toolbar p{margin:4px 0 0;color:#71858e;font-size:12px}
    .rx-preview-content{min-height:0;max-height:none!important;margin:0!important;padding:24px!important;overflow:auto;background:#edf1f4}
    .rx-preview-content .prescription-document{min-width:190mm;background:#fff;padding:20px;box-sizing:content-box;box-shadow:0 3px 18px #20334b15}
    .rx-preview-actions{display:flex;flex-shrink:0;align-items:center;gap:10px;margin:0;padding:14px 22px!important;border-top:1px solid #e1e9ed}
    .rx-preview-actions span{margin-right:auto;color:#71858e;font-size:11px}.rx-preview-error{padding:8px 22px;color:#a13a3a;font-size:12px}
    @media(max-width:520px){.rx-preview-toolbar,.rx-preview-actions{padding:14px!important}.rx-preview-content{padding:12px!important}}`],
  encapsulation: ViewEncapsulation.None,
})
export class PrescriptionPreviewComponent {
  record: PrescriptionRecord;
  errorMessage = '';
  constructor(@Inject(MAT_DIALOG_DATA) data: { record: PrescriptionRecord }) {
    this.record = copyPrescription(data.record);
  }
  print(): void {
    this.errorMessage = printPrescription(this.record) ? '' : 'Allow pop-ups for this site to print the prescription.';
  }
}
