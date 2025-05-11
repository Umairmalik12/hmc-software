import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatDate } from '@angular/common';
import { LabPatient } from 'src/app/Models/lab.model';

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
    this.labTestDetails = labTestDetails;
    this.edit = !!labTestDetails?.patientId; // Check if editing

    this.labPatientForm = this.fb.group({
      patientId: [{ value: this.labTestDetails.patientId || Math.floor(100000 + Math.random() * 900000), disabled: true }],

      name: [this.labTestDetails?.name || '', [Validators.required, Validators.pattern('[a-zA-Z ]+')]],
      phone: [this.labTestDetails?.phone || '', [Validators.required, Validators.pattern('^[0-9]{10,15}$')]],
      testName: [this.labTestDetails?.testName || '', Validators.required],
      price: [this.labTestDetails?.price || '', Validators.required],
      suggestedDr: [this.labTestDetails?.suggestedDr || '', [Validators.required, Validators.pattern('[a-zA-Z ]+')]],
      dateTime: [this.labTestDetails?.dateTime ? formatDate(this.labTestDetails.dateTime, 'yyyy-MM-dd', 'en') : '', Validators.required]
    });
  }

  get c() { return this.labPatientForm.controls; }

  onSubmit() {
    if (this.labPatientForm.valid) {
      let choice = this.labPatientForm.dirty ? confirm('Submitting Patient Form') : true;
      if (choice) {
        this.labPatientForm.enable();
        this.dialogRef.close(this.getFormattedLabPatientData());
      }
    }
  }

  close() {
    let choice = this.labPatientForm.dirty ? confirm('Closing Without Saving Changes') : true;
    if (choice) this.dialogRef.close();
  }

  private getFormattedLabPatientData() {
    return {
      patientId: this.c['patientId'].value,
      name: this.c['name'].value,
      phone: this.c['phone'].value,
      testName: this.c['testName'].value,
      price: this.c['price'].value,
      suggestedDr: this.c['suggestedDr'].value,
      dateTime: this.c['dateTime'].value
    };
  }
}
