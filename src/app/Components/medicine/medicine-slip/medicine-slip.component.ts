import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Medicine } from 'src/app/Models/medicine.model';

@Component({
  selector: 'app-medicine-slip',
  templateUrl: './medicine-slip.component.html',
  styleUrls: ['./medicine-slip.component.css']
})
export class MedicineSlipComponent {
  constructor(
    public dialogRef: MatDialogRef<MedicineSlipComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { medicines: Medicine[] }
  ) {}

  print() {
    window.print();
  }

  close() {
    this.dialogRef.close();
  }
}

