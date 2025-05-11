import { formatDate } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Opd } from 'src/app/Models/opd.model';

@Component({
  selector: 'app-opd-edit',
  templateUrl: './opd-edit.component.html',
  styleUrls: ['./opd-edit.component.css']
})
export class OpdEditComponent {
  edit: boolean = false;
  opdDetails: Opd;
  opdForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OpdEditComponent>,
    @Inject(MAT_DIALOG_DATA) opdDetails: Opd
  ) {

    
    this.opdDetails = opdDetails;

    this.edit = !!opdDetails.patientId;

    this.opdForm = this.fb.group({
      patientId: [{ value: this.opdDetails.patientId || Math.floor(100000 + Math.random() * 900000), disabled: true }],
      dateTime: [this.opdDetails.dateTime ? formatDate(this.opdDetails.dateTime, 'yyyy-MM-dd HH:mm', 'en') : '', Validators.required],
      patientName: [this.opdDetails.patientName || '', Validators.required],
      age: [this.opdDetails.age || '', Validators.required],
      sex: [this.opdDetails.sex, Validators.required],
      bp: [this.opdDetails.bp, Validators.required],
      temp: [this.opdDetails.temp, Validators.required],
      weight: [this.opdDetails.weight, Validators.required],
      patientCategory: [this.opdDetails.patientCategory, Validators.required],
      amount: [this.opdDetails.amount, [Validators.required, Validators.pattern('^[0-9]+$')]],
      phone: [this.opdDetails.phone || '', [Validators.required, Validators.pattern('^[0-9]+$')]],
      address: [this.opdDetails.address || '', Validators.required],
      history: [this.opdDetails.history, Validators.required],
      drName: [this.opdDetails.drName || '', Validators.required],
      followUp: [this.opdDetails.followUp || '', Validators.required]
    });
  }

  onSubmit() {
    if (this.opdForm.valid) {
      let confirmSubmit = confirm("Submit OPD form?");
      if (confirmSubmit) {
        this.opdForm.get('patientId')?.enable();
        const opdData = this.opdForm.value;
        this.opdForm.get('patientId')?.disable();
        this.dialogRef.close(opdData);
      }
    }
  }

  close() {
    let confirmClose = confirm("Close without saving changes?");
    if (confirmClose) this.dialogRef.close();
  }
}
