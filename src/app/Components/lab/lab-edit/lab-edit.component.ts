import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { formatDate } from '@angular/common';
import { LabPatient } from 'src/app/Models/lab.model';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

@Component({
  selector: 'app-lab-edit',
  templateUrl: './lab-edit.component.html',
  styleUrls: ['./lab-edit.component.css']
})
export class LabEditComponent implements OnInit {
  edit: boolean = false;
  labPatientForm!: FormGroup;
  labTestDetails: LabPatient;

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
    @Inject(MAT_DIALOG_DATA) labTestDetails: any,
    private indexedDbService: IndexedDbService
  ) {
    this.labTestDetails = labTestDetails;
    this.edit = !!labTestDetails?.patientId;
  }

  async ngOnInit() {
    const draft = await this.indexedDbService.getItem<Partial<LabPatient>>('labFormDraft');

    this.labPatientForm = this.fb.group({
      patientId: [{ 
        value: this.labTestDetails.patientId || draft?.patientId || Math.floor(100000 + Math.random() * 900000), 
        disabled: this.edit
      }],
      name: [this.labTestDetails?.name || draft?.name || '', [Validators.required, Validators.pattern('[a-zA-Z ]+')]],
      phone: [this.labTestDetails?.phone || draft?.phone || '', [Validators.required, Validators.pattern('^[0-9]{10,15}$')]],
      testName: [this.labTestDetails?.testName || draft?.testName || '', Validators.required],
      price: [this.labTestDetails?.price || draft?.price || '', Validators.required],
      suggestedDr: [this.labTestDetails?.suggestedDr || draft?.suggestedDr || '', [Validators.required, Validators.pattern('[a-zA-Z ]+')]],
      dateTime: [this.labTestDetails?.dateTime ? formatDate(this.labTestDetails.dateTime, 'yyyy-MM-dd', 'en') : draft?.dateTime || '', Validators.required]
    });

    this.labPatientForm.valueChanges.subscribe(async value => {
      await this.indexedDbService.setItem('labFormDraft', {
        ...value,
        patientId: this.labPatientForm.get('patientId')?.value
      });
    });
  }

  get c() {
    return this.labPatientForm.controls;
  }

  async onSubmit() {
    if (this.labPatientForm.valid) {
      let choice = this.labPatientForm.dirty ? confirm('Submitting Patient Form') : true;
      if (choice) {
        this.labPatientForm.enable();
        await this.indexedDbService.removeItem('labFormDraft');
        this.dialogRef.close(this.getFormattedLabPatientData());
              window.location.reload();
      }
    }
  }

  async close() {
    let choice = this.labPatientForm.dirty ? confirm('Closing Without Saving Changes') : true;
    if (choice) {
      this.dialogRef.close();
    }
  }

  private getFormattedLabPatientData(): LabPatient {
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
