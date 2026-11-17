import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MedicineService } from '../../../Services/medicine.service';
import { Medicine } from '../../../Models/medicine.model';
import { NotifyUpdateService } from '../../../Services/notify-update.service';
import { requiredText } from 'src/app/Services/validators.service';
import { MedicineCatalogComponent } from '../../precipion/medicine-catalog/medicine-catalog.component';

@Component({
  selector: 'app-medicine-edit',
  templateUrl: './medicine-edit.component.html',
  styleUrls: ['./medicine-edit.component.css']
})
export class MedicineEditComponent implements OnInit {

  edit: boolean = false;
  medicineForm!: FormGroup;
  saving = false;
  saveError = '';

  constructor(
    private fb: FormBuilder,
    private medicineService: MedicineService,
    private dialogRef: MatDialogRef<MedicineEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { medicines: Medicine[] } | null,
    private notifyUpdate: NotifyUpdateService,
    private dialog: MatDialog
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
      roomNo: [defaultData.roomNo],
      patientName: [defaultData.patientName, [Validators.required, requiredText]],
      doctorName: [defaultData.doctorName],
      medicines: this.fb.array(medicines.length > 0 ? medicines[0].medicines.map((med: any) => this.createMedicineGroup(med.medicineName, med.quantity)) : [this.createMedicineGroup()])
    });
  }

  createMedicineGroup(name: string = '', qty: number = 1): FormGroup {
    return this.fb.group({
      medicineName: [name, [Validators.required, requiredText]],
      quantity: [qty, [Validators.required, Validators.min(1)]]
    });
  }

  get medicines(): FormArray {
    return this.medicineForm.get('medicines') as FormArray;
  }

  addMedicine() {
    this.medicines.push(this.createMedicineGroup());
  }

  manageMedicines(): void {
    if (this.saving) return;
    this.dialog.open(MedicineCatalogComponent, { data: { embedded: true }, width: '900px', maxWidth: '96vw', maxHeight: '90vh', panelClass: 'hmc-dialog-panel' });
  }

  removeMedicine(index: number) {
    if (this.medicines.length > 1) {
      this.medicines.removeAt(index);
    }
  }

  get f() { return this.medicineForm; }

  async onSubmit() {
    if (this.saving) return;
    if (this.medicineForm.invalid) {
      this.medicineForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.saveError = '';
    try {
      const formValue = this.medicineForm.getRawValue();
      const medicines = formValue.medicines.map((med: any) => ({
        medicineName: med.medicineName.trim(),
        quantity: Number(med.quantity)
      }));
      const medicineData: Medicine = {
        medicineId: Number(formValue.medicineId) || 0,
        roomNo: formValue.roomNo,
        patientName: formValue.patientName.trim(),
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
        this.saveError = 'Daily medicine record could not be saved. Your entries are kept; please try again.'; this.notifyUpdate.error(this.saveError);
      }
    } catch (error) {
      this.saveError = 'Unable to save this medicine record. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  close() {
    this.dialogRef.close();
  }
}
