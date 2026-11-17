import { DatePipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { requiredText, ValidatorsService } from 'src/app/Services/validators.service';

@Component({
  selector: 'app-patient-edit',
  templateUrl: './patient-edit.component.html',
  styleUrls: ['./patient-edit.component.css']
})
export class PatientEditComponent {

  edit: boolean = false;
  patientDetails: PatientDetail;
  patientForm: FormGroup;
  tempAge: number | null = null;
  tempDate: string | null = null;

  constructor(private fb: FormBuilder, private fv: ValidatorsService,
    private dialogRef: MatDialogRef<PatientEditComponent>,
    @Inject(MAT_DIALOG_DATA) patientDetails: PatientDetail) {

    this.patientDetails = { ...patientDetails };

    if (patientDetails.patientId) {
      this.edit = true;
      this.tempAge = this.patientDetails.age;
    }
    else {
      this.patientDetails.createdAt = new Date().toISOString();
      this.patientDetails.procedure = '';
    }

    this.patientForm = this.fb.group({
      patientDetail: this.fb.group({
           patientId: [this.patientDetails.patientId || null, [Validators.min(1)]],
           createdAt: [this.patientDetails.createdAt || '', []],
        fullName: this.fb.group({
          firstName: [this.patientDetails.firstName, [Validators.required, requiredText]],
          lastName: [this.patientDetails.lastName || ''],
          drName: [this.patientDetails.drName || ''],
        }),
        bioDetail: this.fb.group({
          gender: [this.patientDetails.gender || ''],
          age: [this.tempAge, [Validators.min(0), Validators.max(120)]],
        }),
        procedureInfo: this.fb.group({
          procedure: [this.patientDetails.procedure || ''],
        }),
        socialDetail: this.fb.group({
          phone: [this.patientDetails.phone || '', Validators.pattern(/^[+\d\s()-]{7,20}$/)],
        }),
        addressDetail: this.fb.group({
          city: [this.patientDetails.city || ''],
          address: [this.patientDetails.address || '']
        })
      })
    });

  }


  // getters for form inputs
  get a() { return this.patientForm.controls; }
  get b() { return (this.patientForm.get('patientDetail') as FormGroup).controls; }
  get c() { return ((this.patientForm.get('patientDetail') as FormGroup).get('fullName') as FormGroup).controls; }
  get d() { return ((this.patientForm.get('patientDetail') as FormGroup).get('bioDetail') as FormGroup).controls; }
  get f() { return ((this.patientForm.get('patientDetail') as FormGroup).get('socialDetail') as FormGroup).controls; }
  get g() { return ((this.patientForm.get('patientDetail') as FormGroup).get('addressDetail') as FormGroup).controls; }
  get h() { return ((this.patientForm.get('patientDetail') as FormGroup).get('procedureInfo') as FormGroup).controls; }

  // form submit function
  onSubmit() {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      return;
    }

    const result = this.ResultRefactoring();
    if (this.edit) {
      result.oldId = this.patientDetails.patientId;
    }
    this.dialogRef.close(result);
  }

  close() {
    let choice = true;
    if (this.patientForm.dirty) choice = confirm("Closing Without Saving changes");
    if (choice) this.dialogRef.close();
  }

  ResultRefactoring(): PatientDetail {
    let tempPatient: PatientDetail = {
      patientId: Number(this.b['patientId'].value) || 0,
      createdAt: this.b['createdAt'].value,
      firstName: this.c['firstName'].value.trim(), lastName: this.c['lastName'].value, drName: this.c['drName'].value,
      gender: this.d['gender'].value, age: this.d['age'].value,
      // Preserve existing data without collecting marital status in the form.
      maritalStatus: this.patientDetails.maritalStatus || '',
      phone: this.f['phone'].value,
      city: this.g['city'].value,
      address: this.g['address'].value,
      procedure: this.h['procedure'].value
    };

    return tempPatient;
  }

}
