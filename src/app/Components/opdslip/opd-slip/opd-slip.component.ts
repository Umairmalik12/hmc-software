import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Opd } from 'src/app/Models/opd.model';

@Component({
  selector: 'app-opd-slip',
  templateUrl: './opd-slip.component.html',
  styleUrls: ['./opd-slip.component.css']
})
export class OpdSlipComponent {
  constructor(
    public dialogRef: MatDialogRef<OpdSlipComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { opds: Opd[] }
  ) {}

  print() {
    window.print();
  }

  close() {
    this.dialogRef.close();
  }
}
