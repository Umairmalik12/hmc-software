import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatDate } from '@angular/common';
import { LabPatient } from 'src/app/Models/lab.model';
import { requiredText } from 'src/app/Services/validators.service';

@Component({
  selector: 'app-lab-edit',
  templateUrl: './lab-edit.component.html',
  styleUrls: ['./lab-edit.component.css']
})
export class LabEditComponent {
  edit: boolean = false;
  labPatientForm: FormGroup;
  labTestDetails: LabPatient

  
  testList = [
    { value: 'rpm', viewValue: 'RPM' },
    { value: 'hb', viewValue: 'H/B' },
    { value: 'cue', viewValue: 'CUE' },
    { value: 'rbs', viewValue: 'RBS' },
    { value: 'cbc', viewValue: 'CBC' },
    { value: 'se', viewValue: 'S/E' },
    { value: 'uric_acid', viewValue: 'Uric Acid' },
    { value: 'anti_hcv', viewValue: 'Anti-HCV' },
    { value: 'hbs_ag', viewValue: 'HBS AG' },
    { value: 'psa', viewValue: 'PSA' },
    { value: 'blood_group', viewValue: 'Blood Group' },
    { value: 'cross_match', viewValue: 'Cross Match' },
    { value: 'lfts', viewValue: 'LFTs' },
    { value: 'lipo_profile', viewValue: 'Lipo-Profile' },
    { value: 'xray', viewValue: 'X-ray' } 
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LabEditComponent>,
    @Inject(MAT_DIALOG_DATA)  labTestDetails: any
  ) {
    this.labTestDetails = { ...labTestDetails };
    this.edit = !!labTestDetails?.patientId; // Check if editing

    this.labPatientForm = this.fb.group({
      patientId: [{ value: this.labTestDetails?.patientId || null, disabled: this.edit }, Validators.min(1)],
      name: [this.labTestDetails?.name || '', [Validators.required, requiredText]],
      phone: [this.labTestDetails?.phone || '', Validators.pattern(/^[+\d\s()-]{7,20}$/)],
      testName: [Array.isArray(labTestDetails?.testName)
        ? [...labTestDetails.testName]
        : (labTestDetails?.testName || '').split(',').map((test: string) => test.trim()).filter(Boolean), Validators.required],
      price: [this.labTestDetails?.price ?? null, Validators.min(0)],
      suggestedDr: [this.labTestDetails?.suggestedDr || ''],
      dateTime: [formatDate(this.labTestDetails?.dateTime || new Date(), "yyyy-MM-dd'T'HH:mm", 'en')]
    });
  }

  get c() { return this.labPatientForm.controls; }

  onSubmit() {
    if (this.labPatientForm.invalid) {
      this.labPatientForm.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.getFormattedLabPatientData());
  }

  close() {
    let choice = this.labPatientForm.dirty ? confirm('Closing Without Saving Changes') : true;
    if (choice) this.dialogRef.close();
  }

  private getFormattedLabPatientData() {
    const formValue = this.labPatientForm.getRawValue();
    return {
      patientId: Number(formValue.patientId) || 0,
      name: formValue.name.trim(),
      phone: formValue.phone || '',
      testName: formValue.testName.join(', '),
      price: Number(formValue.price),
      suggestedDr: formValue.suggestedDr,
      dateTime: new Date(formValue.dateTime || Date.now())
    };
  }
}
