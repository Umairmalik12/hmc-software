import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MedicineService } from '../../../Services/medicine.service';
import { Medicine } from '../../../Models/medicine.model';
import { NotifyUpdateService } from '../../../Services/notify-update.service';

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
    @Inject(MAT_DIALOG_DATA) public data: { medicines: Medicine[] } | null,
    private notifyUpdate: NotifyUpdateService
  ) {}

  ngOnInit() {
    const medicines = this.data?.medicines || [];
    this.edit = medicines.length > 0 && medicines[0].medicineId > 0;

    const defaultData = medicines.length > 0 ? medicines[0] : {
      medicineId: 0,
      roomNo: '',
      patientName: '',
      medicines: [],
      doctorName: '',
      createdAt: new Date().toISOString()
    };

    this.medicineForm = this.fb.group({
      medicineId: [{value: defaultData.medicineId, disabled: true}],
      createdAt: [{value: defaultData.createdAt, disabled: true}],
      roomNo: [defaultData.roomNo, Validators.required],
      patientName: [defaultData.patientName, Validators.required],
      doctorName: [defaultData.doctorName],
      medicines: this.fb.array(medicines.length > 0 ? medicines[0].medicines.map((med: any) => this.createMedicineGroup(med.medicineName, med.quantity)) : [this.createMedicineGroup()])
    });
  }

  createMedicineGroup(name: string = '', qty: number = 0): FormGroup {
    return this.fb.group({
      medicineName: [name, Validators.required],
      quantity: [qty, [Validators.required, Validators.min(0)]]
    });
  }

  get medicines(): FormArray {
    return this.medicineForm.get('medicines') as FormArray;
  }

  addMedicine() {
    this.medicines.push(this.createMedicineGroup());
  }

  removeMedicine(index: number) {
    if (this.medicines.length > 1) {
      this.medicines.removeAt(index);
    }
  }

  get f() { return this.medicineForm; }

  async onSubmit() {
    if (this.medicineForm.valid) {
      const formValue = this.medicineForm.getRawValue();
      const medicines = formValue.medicines.map((med: any) => ({
        medicineName: med.medicineName,
        quantity: med.quantity
      }));
      const medicineData: Medicine = {
        medicineId: Number(formValue.medicineId) || 0,
        roomNo: formValue.roomNo,
        patientName: formValue.patientName,
        medicines: medicines,
        doctorName: formValue.doctorName,
        createdAt: formValue.createdAt
      };
      
      let success = false;
      if (this.edit) {
        success = await this.medicineService.updateMedicine(medicineData);
      } else {
        success = await this.medicineService.addNewMedicine(medicineData);
      }

      if (success) {
        this.dialogRef.close(medicineData);
      } else {
        this.notifyUpdate.alertNotify.next({ msg: "Operation failed. Please try again.", type: "error" });
      }
    }
  }

  close() {
    this.dialogRef.close();
  }
}
