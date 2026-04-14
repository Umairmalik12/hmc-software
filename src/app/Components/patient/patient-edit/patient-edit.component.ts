import { DatePipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PatientDetail } from 'src/app/Models/patientDetail.model';
import { ValidatorsService } from 'src/app/Services/validators.service';

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

    this.patientDetails = patientDetails;

    if (patientDetails.patientId) {
      this.edit = true;
      this.tempAge = this.patientDetails.age;
    }
    else {
      this.patientDetails.gender = "Male";
      this.patientDetails.createdAt = new Date().toISOString();
    }

    this.patientForm = this.fb.group({
      patientDetail: this.fb.group({
           patientId: [this.patientDetails.patientId || null, [Validators.required, Validators.min(1)]],
           createdAt: [this.patientDetails.createdAt || '', []],
        fullName: this.fb.group({
          firstName: [this.patientDetails.firstName, [Validators.required]],
          lastName: [this.patientDetails.lastName, [Validators.required]],
          drName: [this.patientDetails.drName, [Validators.required]],
        }),
        bioDetail: this.fb.group({
          gender: [this.patientDetails.gender, Validators.required],
          age: [ this.tempAge , Validators.required],
        }),
        familyStatus: this.fb.group({
          maritalStatus: [this.patientDetails.maritalStatus, Validators.required],
        }),
        socialDetail: this.fb.group({
          phone: [this.patientDetails.phone, [Validators.required]],
        }),
        addressDetail: this.fb.group({
          city: [this.patientDetails.city, [Validators.required, Validators.pattern('[a-z A-Z]+')]],
          address: [this.patientDetails.address, Validators.required]
        })
      })
    });

  }


  // getters for form inputs
  get a() { return this.patientForm.controls; }
  get b() { return (this.patientForm.get('patientDetail') as FormGroup).controls; }
  get c() { return ((this.patientForm.get('patientDetail') as FormGroup).get('fullName') as FormGroup).controls; }
  get d() { return ((this.patientForm.get('patientDetail') as FormGroup).get('bioDetail') as FormGroup).controls; }
  get e() { return ((this.patientForm.get('patientDetail') as FormGroup).get('familyStatus') as FormGroup).controls; }
  get f() { return ((this.patientForm.get('patientDetail') as FormGroup).get('socialDetail') as FormGroup).controls; }
  get g() { return ((this.patientForm.get('patientDetail') as FormGroup).get('addressDetail') as FormGroup).controls; }

  // form submit function
  onSubmit() {
    if (!this.patientForm.invalid) {

      let choice = true;
      if (this.patientForm.dirty) choice = confirm("Submitting Patinent Form");

      if (choice) {
        this.patientForm.enable();
        let result: PatientDetail = this.ResultRefactoring();
        this.dialogRef.close(result);
      }
    }
  }

  close() {
    let choice = true;
    if (this.patientForm.dirty) choice = confirm("Closing Without Saving changes");
    if (choice) this.dialogRef.close();
  }

  ResultRefactoring(): PatientDetail {
    console.log(this.d['age'].value,"this.d['age'].value")
    let tempPatient: PatientDetail = {
      patientId: this.b['patientId'].value,
      createdAt: this.b['createdAt'].value,
      firstName: this.c['firstName'].value, lastName: this.c['lastName'].value, drName: this.c['drName'].value,
      gender: this.d['gender'].value, age: this.d['age'].value,
      maritalStatus: this.e['maritalStatus'].value,
      phone: this.f['phone'].value,
      city: this.g['city'].value,
      address: this.g['address'].value
    };

    return tempPatient;
  }

}
