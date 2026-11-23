import { Component, Inject, OnDestroy, Optional } from '@angular/core';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LabPatient } from 'src/app/Models/lab.model';
import { requiredText } from 'src/app/Services/validators.service';
import { selectedDateTime, validSelectedDateTime } from 'src/app/Shared/date-time-values';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';
import { Subscription } from 'rxjs';
import { replacePatientPrefill } from 'src/app/Shared/patient-lookup-form';

@Component({
  selector: 'app-lab-edit',
  templateUrl: './lab-edit.component.html',
  styleUrls: ['./lab-edit.component.css']
})
export class LabEditComponent implements OnDestroy {
  edit: boolean = false;
  labPatientForm: FormGroup;
  labTestDetails: LabPatient
  matchedPatient = '';
  private lookupVersion = 0;
  private subscription?: Subscription;
  private patientPrefill: Record<string, unknown> = {};

  
constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LabEditComponent>,
    @Inject(MAT_DIALOG_DATA)  labTestDetails: any,
    private feedback: NotifyUpdateService = new NotifyUpdateService(),
    @Optional() private patientLookup: PatientLookupService | null = null
  ) {
    this.labTestDetails = { ...labTestDetails };
    this.edit = !!labTestDetails?.labId || !!labTestDetails?.patientId;

    this.labPatientForm = this.fb.group({
      mrNumber: [this.labTestDetails?.mrNumber ?? this.labTestDetails?.patientId ?? null, [Validators.min(1)]],
      name: [this.labTestDetails?.name || '', [Validators.required, requiredText]],
      phone: [this.labTestDetails?.phone || '', Validators.pattern(/^[+\d\s()-]{7,20}$/)],
      testName: [Array.isArray(labTestDetails?.testName)
        ? [...labTestDetails.testName]
        : (labTestDetails?.testName || '').split(',').map((test: string) => test.trim()).filter(Boolean), Validators.required],
      price: [this.labTestDetails?.price ?? null, Validators.min(0)],
      suggestedDr: [this.labTestDetails?.suggestedDr || ''],
      dateTime: [this.edit ? this.labTestDetails?.dateTime || '' : '', validSelectedDateTime]
    });
    this.subscription = this.labPatientForm.get('mrNumber')!.valueChanges.subscribe(value => { if (!this.edit) void this.lookupPatient(value); });
  }

  ngOnDestroy(): void { this.lookupVersion++; this.subscription?.unsubscribe(); }

  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.lookupVersion, mr = Number(value); this.matchedPatient = '';
    this.patientPrefill = replacePatientPrefill(this.labPatientForm, this.patientPrefill, {});
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.lookupVersion || Number(this.labPatientForm.get('mrNumber')!.value) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      this.patientPrefill = replacePatientPrefill(this.labPatientForm, {}, { name, phone: patient.phone, suggestedDr: patient.drName });
      this.matchedPatient = name;
    } catch { if (version === this.lookupVersion) this.matchedPatient = ''; }
  }

  get c() { return this.labPatientForm.controls; }

  onSubmit() {
    if (this.labPatientForm.invalid) {
      this.labPatientForm.markAllAsTouched();
      this.feedback.warning('Complete the highlighted laboratory fields before saving.');
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
      labId: this.labTestDetails?.labId,
      mrNumber: formValue.mrNumber ? Number(formValue.mrNumber) : undefined,
      patientId: formValue.mrNumber ? Number(formValue.mrNumber) : this.labTestDetails?.patientId,
      name: formValue.name.trim(),
      phone: formValue.phone || '',
      testName: formValue.testName.join(', '),
      price: Number(formValue.price),
      suggestedDr: formValue.suggestedDr,
      dateTime: selectedDateTime(formValue.dateTime)
    };
  }
}
