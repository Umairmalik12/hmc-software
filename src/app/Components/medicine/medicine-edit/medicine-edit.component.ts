import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MedicineService } from '../../../Services/medicine.service';
import { Medicine } from '../../../Models/medicine.model';

@Component({
  selector: 'app-medicine-edit',
  templateUrl: './medicine-edit.component.html',
  styleUrls: ['./medicine-edit.component.css']
})
export class MedicineEditComponent implements OnInit {

  edit: boolean = false;
  medicineForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private medicineService: MedicineService,
    private dialogRef: MatDialogRef<MedicineEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit() {
    const defaultData: Medicine = {
      medicineId: this.data?.medicineId || 0,
      roomNo: this.data?.roomNo || '',
      patientName: this.data?.patientName || '',
      medicineName: this.data?.medicineName || '',
      quantity: this.data?.quantity || 0,
      dosage: this.data?.dosage || '',
      doctorName: this.data?.doctorName || '',
      notes: this.data?.notes || '',
      createdAt: this.data?.createdAt || new Date().toISOString()
    };

    this.edit = !!defaultData.medicineId;

    this.medicineForm = this.fb.group({
      medicineId: [{value: defaultData.medicineId, disabled: true}],
      roomNo: [defaultData.roomNo, Validators.required],
      patientName: [defaultData.patientName, Validators.required],
      medicineName: [defaultData.medicineName, Validators.required],
      quantity: [defaultData.quantity, [Validators.required, Validators.min(0)]],
      dosage: [defaultData.dosage],
      doctorName: [defaultData.doctorName],
      notes: [defaultData.notes],
      createdAt: [{value: defaultData.createdAt, disabled: true}]
    });
  }

  get f() { return this.medicineForm; }

  async onSubmit() {
    if (this.medicineForm.valid) {
      const medicineData: Medicine = this.medicineForm.value;
      let success = false;
      if (this.edit) {
        success = await this.medicineService.updateMedicine(medicineData);
      } else {
        success = await this.medicineService.addNewMedicine(medicineData);
      }

      if (success) {
        this.dialogRef.close(medicineData);
      } else {
        alert('Operation failed. Please try again.');
      }
    }
  }

  close() {
    this.dialogRef.close();
  }
}
