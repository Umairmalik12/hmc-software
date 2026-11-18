import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Opd } from 'src/app/Models/opd.model';
import { printThermal } from '../../patient-token/thermal-print';
import { buildOpdThermalPrint, OPD_THERMAL_CSS } from './opd-thermal-receipt';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';

@Component({
  selector: 'app-opd-slip',
  templateUrl: './opd-slip.component.html',
  styleUrls: ['./opd-slip.component.css'],
  styles: [OPD_THERMAL_CSS],
  encapsulation: ViewEncapsulation.None,
})
export class OpdSlipComponent {
  readonly opds: Opd[];
  readonly html: string;
  paperWidth: 58 | 80 = 80;
  constructor(public dialogRef: MatDialogRef<OpdSlipComponent>, @Inject(MAT_DIALOG_DATA) data: { opds: Opd[] }, private feedback: NotifyUpdateService = new NotifyUpdateService()) {
    this.opds = (data?.opds || []).map(opd => ({ ...opd }));
    this.html = buildOpdThermalPrint(this.opds);
    try { this.paperWidth = localStorage.getItem('hmc.opdPaperWidth') === '58' ? 58 : 80; } catch { /* Use the default roll width. */ }
  }
  print(): void {
    if (!this.opds.length) return;
    try { localStorage.setItem('hmc.opdPaperWidth', String(this.paperWidth)); } catch { /* Use this session's selection. */ }
    printThermal('<style>' + OPD_THERMAL_CSS + '</style>' + buildOpdThermalPrint(this.opds), this.paperWidth, 'opd-thermal-print', this.feedback);
  }
  close(): void { this.dialogRef.close(); }
}
