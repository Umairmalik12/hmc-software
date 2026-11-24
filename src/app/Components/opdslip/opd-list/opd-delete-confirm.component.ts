import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface OpdDeleteConfirmData {
  patientName: string;
  mrNumber: string | number;
}

@Component({
  selector: 'app-opd-delete-confirm',
  template: `
    <h2 mat-dialog-title><mat-icon>delete_outline</mat-icon><span>Delete OPD record<small>Confirm this patient visit</small></span></h2>
    <mat-dialog-content>
      <p class="confirm-question">Are you sure you want to delete this OPD record?</p>
      <section class="patient-summary" aria-label="OPD record details">
        <div><span>Patient name</span><strong>{{ data.patientName || 'Not recorded' }}</strong></div>
        <div><span>MR Number</span><strong>{{ data.mrNumber || 'Not recorded' }}</strong></div>
      </section>
      <p class="confirm-note">This action cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false" cdkFocusInitial>Cancel</button>
      <button mat-flat-button color="warn" type="button" [mat-dialog-close]="true"><mat-icon>delete_outline</mat-icon>Confirm Delete</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host{display:block;color:#20383d}h2[mat-dialog-title]{display:flex;align-items:center;gap:12px;margin:0;padding:20px 24px;border-bottom:1px solid #e5edef;color:#173a3d;font-size:18px;font-weight:700}
    h2 mat-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#fff0ef;color:#c63838}h2 small{display:block;margin-top:3px;color:#718286;font-size:12px;font-weight:400}
    mat-dialog-content{padding:20px 24px 10px}.confirm-question{margin:0 0 16px;font-size:14px;font-weight:600}.patient-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px;border:1px solid #e2eaec;border-radius:10px;background:#f7fafb}.patient-summary div{min-width:0}.patient-summary span{display:block;margin-bottom:5px;color:#728387;font-size:11px}.patient-summary strong{display:block;overflow-wrap:anywhere;color:#1f3d42;font-size:13px}.confirm-note{margin:14px 0 2px;color:#77878a;font-size:12px}
    mat-dialog-actions{gap:8px;padding:12px 24px 20px}mat-dialog-actions button mat-icon{margin-right:4px}
    @media(max-width:480px){.patient-summary{grid-template-columns:1fr}h2[mat-dialog-title],mat-dialog-content{padding-left:18px;padding-right:18px}mat-dialog-actions{padding-left:18px;padding-right:18px}}
  `],
})
export class OpdDeleteConfirmComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: OpdDeleteConfirmData) {}
}
