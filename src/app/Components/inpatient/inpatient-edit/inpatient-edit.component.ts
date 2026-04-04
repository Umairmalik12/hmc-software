import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { InpatientService } from '../../../Services/inpatient.service';

@Component({
  selector: 'app-inpatient-edit',
  templateUrl: './inpatient-edit.component.html',
  styleUrls: ['./inpatient-edit.component.css']
})
export class InpatientEditComponent {

  edit: boolean = false;
  inpatientForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<InpatientEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    const defaultData = data || { inpatientId: 0, patientName: '', procedure: '', admissionDate: '', dischargeDate: '', surgeonName: '' };

    if (defaultData.inpatientId) {
      this.edit = true;
    }

    this.inpatientForm = this.fb.group({
      inpatientDetail: this.fb.group({
        inpatientId: [defaultData.inpatientId],
        basicInfo: this.fb.group({
          patientName: [defaultData.patientName, Validators.required],
          surgeonName: [defaultData.surgeonName, Validators.required],
        }),
        procedureInfo: this.fb.group({
          procedure: [defaultData.procedure, Validators.required],
        }),
        dates: this.fb.group({
          admissionDate: [defaultData.admissionDate, Validators.required],
          dischargeDate: [defaultData.dischargeDate, Validators.required],
        })
      })
    });
  }

  // Form getters
  get a() { return this.inpatientForm.controls; }
  get b() { return (this.inpatientForm.get('inpatientDetail') as FormGroup).controls; }
  get c() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('basicInfo') as FormGroup).controls; }
  get d() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('procedureInfo') as FormGroup).controls; }
  get e() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('dates') as FormGroup).controls; }

  onSubmit() {
    if (this.inpatientForm.valid) {
      let choice = true;
      if (this.inpatientForm.dirty) choice = confirm(this.edit ? "Update InnPatient?" : "Submit New InnPatient?");

      if (choice) {
        const result: any = this.ResultRefactoring();
        this.dialogRef.close(result);
      }
    }
  }

  close() {
    let choice = true;
    if (this.inpatientForm.dirty) choice = confirm("Close without saving?");
    if (choice) this.dialogRef.close();
  }

  ResultRefactoring(): any {
    return {
      inpatientId: this.b['inpatientId'].value,
      patientName: this.c['patientName'].value,
      surgeonName: this.c['surgeonName'].value,
      procedure: this.d['procedure'].value,
      admissionDate: this.e['admissionDate'].value,
      dischargeDate: this.e['dischargeDate'].value
    };
  }
}
