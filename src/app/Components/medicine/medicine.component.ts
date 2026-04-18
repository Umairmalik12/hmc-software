import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MedicineEditComponent } from './medicine-edit/medicine-edit.component';
import { Medicine } from '../../Models/medicine.model';
import { MedicineService } from '../../Services/medicine.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';

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
    medicines: [],
    doctorName: '',
    createdAt: new Date().toISOString()
  };

  constructor(
    private dialog: MatDialog,
    private medicineService: MedicineService,
    private notifyUpdate: NotifyUpdateService
  ) {}

  addNewMedicine() {
    const dialogRef = this.dialog.open(MedicineEditComponent, {
      disableClose: true,
      autoFocus: true,
      data: { medicines: [] }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notifyUpdate.notify.next(true);
      }
    });
  }
}

