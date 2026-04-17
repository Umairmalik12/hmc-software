import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MedicineEditComponent } from './medicine-edit/medicine-edit.component';
import { Medicine } from '../../Models/medicine.model';
import { MedicineService } from '../../Services/medicine.service';

@Component({
  selector: 'app-medicine',
  templateUrl: './medicine.component.html',
  styleUrls: ['./medicine.component.css']
})
export class MedicineComponent {
  tempMedicine: Medicine = {
    medicineId: 0,
   
    roomNo: '',
    patientName: '',
    medicineName: '',
    quantity: 0,
    dosage: '',
    doctorName: '',
    notes: '',
    createdAt: new Date().toISOString()
  };

  constructor(
    private dialog: MatDialog,
    private medicineService: MedicineService
  ) {}

  addNewMedicine() {
    const dialogRef = this.dialog.open(MedicineEditComponent, {
      disableClose: true,
      autoFocus: true,
      data: this.tempMedicine
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Refresh list via service notify
        window.location.reload(); // Simple refresh for now
      }
    });
  }
}

