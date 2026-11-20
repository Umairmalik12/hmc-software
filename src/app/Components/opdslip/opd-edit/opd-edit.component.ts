import { formatDate } from '@angular/common';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Opd } from 'src/app/Models/opd.model';
import { finiteNumber, requiredText, wholeNumber } from 'src/app/Services/validators.service';

@Component({
  selector: 'app-opd-edit',
  templateUrl: './opd-edit.component.html',
  styleUrls: ['./opd-edit.component.css']
})
export class OpdEditComponent {
  edit: boolean = false;
  oldPatientId: number | undefined;
  opdDetails: Opd;
  opdForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OpdEditComponent>,
    @Inject(MAT_DIALOG_DATA) opdDetails: Opd & {oldPatientId?: number},
    private feedback: NotifyUpdateService = new NotifyUpdateService()
  ) {

    this.opdDetails = { ...opdDetails };
    this.oldPatientId = opdDetails.oldPatientId || opdDetails.patientId;

    this.edit = !!opdDetails.patientId;

    if (!this.edit && !this.opdDetails.createdAt) {
      this.opdDetails.createdAt = new Date().toISOString();
    }

    this.opdForm = this.fb.group({
      patientId: [this.opdDetails.patientId || null, [Validators.required, Validators.min(1), wholeNumber]],
      createdAt: [this.opdDetails.createdAt || ''],
      patientName: [this.opdDetails.patientName || '', [Validators.required, requiredText]],
      age: [this.opdDetails.age ?? null, [Validators.min(0), Validators.max(120), finiteNumber]],
      sex: [this.opdDetails.sex || '', Validators.pattern(/^(Male|Female)$/)],
      bp: [this.opdDetails.bp || ''],
      temp: [this.opdDetails.temp || ''],
      patientCategory: [this.opdDetails.patientCategory || ''],
      procedure: [this.opdDetails.procedure || ''],
      amount: [this.opdDetails.amount ?? null, Validators.min(0)],
      phone: [this.opdDetails.phone || '', Validators.pattern(/^[+\d\s()-]{7,20}$/)],
      address: [this.opdDetails.address || ''],
      history: [this.opdDetails.history || ''],
      drName: [this.opdDetails.drName || ''],
      followUp: [this.opdDetails.followUp || '']
    });
  }

  onSubmit() {
    if (this.opdForm.invalid) {
      this.opdForm.markAllAsTouched();
      this.feedback.warning('Complete the highlighted OPD fields before saving.');
      return;
    }
    const value = this.opdForm.getRawValue();
    this.dialogRef.close({
      ...this.opdDetails, ...value,
      patientId: value.patientId,
      patientName: value.patientName.trim(),
      amount: Number(value.amount) || 0,
      oldPatientId: this.oldPatientId,
    });
  }

  close() {
    let confirmClose = confirm("Close without saving changes?");
    if (confirmClose) this.dialogRef.close();
  }
}
