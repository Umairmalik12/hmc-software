import { Component, Inject, OnDestroy, Optional } from '@angular/core';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { InpatientService } from '../../../Services/inpatient.service';
import { requiredText, wholeNumber } from 'src/app/Services/validators.service';
import { selectedDateTime, validSelectedDateTime } from 'src/app/Shared/date-time-values';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';
import { Subscription } from 'rxjs';
import { replacePatientPrefill } from 'src/app/Shared/patient-lookup-form';

@Component({
  selector: 'app-inpatient-edit',
  templateUrl: './inpatient-edit.component.html',
  styleUrls: ['./inpatient-edit.component.css']
})
export class InpatientEditComponent implements OnDestroy {

  edit: boolean = false;
  inpatientForm: FormGroup;
  matchedPatient = '';
  private lookupVersion = 0;
  private subscription?: Subscription;
  private patientPrefill: Record<string, unknown> = {};

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<InpatientEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private feedback: NotifyUpdateService = new NotifyUpdateService(),
    @Optional() private patientLookup: PatientLookupService | null = null
  ) {
    const defaultData = { inpatientId: 0, patientName: '', procedure: '', admissionDate: '', dischargeDate: '', surgeonName: '', createdAt: '', ...data };

    if (!defaultData.inpatientId) defaultData.createdAt = '';

    if (defaultData.inpatientId) {
      this.edit = true;
    }

    this.inpatientForm = this.fb.group({
      inpatientDetail: this.fb.group({
        inpatientId: [defaultData.inpatientId || null, [Validators.required, Validators.min(1), wholeNumber]],
        mrNumber: [defaultData.mrNumber || null, [Validators.min(1), wholeNumber]],
        createdAt: [defaultData.createdAt || '', validSelectedDateTime],
        basicInfo: this.fb.group({
          patientName: [defaultData.patientName, [Validators.required, requiredText]],
          surgeonName: [defaultData.surgeonName],
        }),
        procedureInfo: this.fb.group({
          procedure: [defaultData.procedure],
        }),
        dates: this.fb.group({
          admissionDate: [defaultData.admissionDate || null],
          dischargeDate: [defaultData.dischargeDate || null],
        })
      })
    });
    this.subscription = this.b['mrNumber'].valueChanges.subscribe(value => { if (!this.edit) void this.lookupPatient(value); });
  }

  ngOnDestroy(): void { this.lookupVersion++; this.subscription?.unsubscribe(); }

  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.lookupVersion, mr = Number(value); this.matchedPatient = '';
    this.patientPrefill = replacePatientPrefill(this.inpatientForm, this.patientPrefill, {});
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.lookupVersion || Number(this.b['mrNumber'].value) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      this.patientPrefill = replacePatientPrefill(this.inpatientForm, {}, { 'inpatientDetail.basicInfo.patientName': name, 'inpatientDetail.basicInfo.surgeonName': patient.drName });
      this.matchedPatient = name;
    } catch { if (version === this.lookupVersion) this.matchedPatient = ''; }
  }

  // Form getters
  get a() { return this.inpatientForm.controls; }
  get b() { return (this.inpatientForm.get('inpatientDetail') as FormGroup).controls; }
  get c() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('basicInfo') as FormGroup).controls; }
  get d() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('procedureInfo') as FormGroup).controls; }
  get e() { return ((this.inpatientForm.get('inpatientDetail') as FormGroup).get('dates') as FormGroup).controls; }
  get f() { return this.b['createdAt']; }

  onSubmit() {
    if (this.inpatientForm.invalid) {
      this.inpatientForm.markAllAsTouched();
      this.feedback.warning('Complete the highlighted inpatient fields before saving.');
      return;
    }
    this.dialogRef.close(this.ResultRefactoring());
  }

  close() {
    let choice = true;
    if (this.inpatientForm.dirty) choice = confirm("Close without saving?");
    if (choice) this.dialogRef.close();
  }

  ResultRefactoring(): any {
    return {
      inpatientId: this.b['inpatientId'].value,
      mrNumber: this.b['mrNumber'].value ? Number(this.b['mrNumber'].value) : undefined,
      patientName: this.c['patientName'].value.trim(),
      surgeonName: this.c['surgeonName'].value,
      procedure: this.d['procedure'].value,
      admissionDate: this.e['admissionDate'].value,
      dischargeDate: this.e['dischargeDate'].value,
      createdAt: selectedDateTime(this.b['createdAt'].value)
    };
  }
}
