import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnDestroy, Optional } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Opd } from 'src/app/Models/opd.model';
import { calendarValue, selectedDateTime, validSelectedDateTime } from 'src/app/Shared/date-time-values';
import { finiteNumber, requiredText, wholeNumber } from 'src/app/Services/validators.service';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-opd-edit',
  templateUrl: './opd-edit.component.html',
  styleUrls: ['./opd-edit.component.css']
})
export class OpdEditComponent implements OnDestroy {
  edit: boolean = false;
  oldPatientId: number | undefined;
  opdDetails: Opd;
  opdForm: FormGroup;
  matchedPatient = '';
  private lookupVersion = 0;
  private subscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OpdEditComponent>,
    @Inject(MAT_DIALOG_DATA) opdDetails: Opd & {oldPatientId?: number},
    private feedback: NotifyUpdateService = new NotifyUpdateService(),
    @Optional() private patientLookup: PatientLookupService | null = null
  ) {

    this.opdDetails = { ...opdDetails };
    this.oldPatientId = opdDetails.oldPatientId || opdDetails.patientId;

    this.edit = !!opdDetails.patientId;

    if (!this.edit) this.opdDetails.createdAt = '';

    this.opdForm = this.fb.group({
      patientId: [this.opdDetails.patientId || null, [Validators.required, Validators.min(1), wholeNumber]],
      createdAt: [this.opdDetails.createdAt || '', validSelectedDateTime],
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
    this.subscription = this.opdForm.get('patientId')!.valueChanges.subscribe(value => { if (!this.edit) void this.lookupPatient(value); });
  }

  ngOnDestroy(): void { this.lookupVersion++; this.subscription?.unsubscribe(); }

  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.lookupVersion; this.matchedPatient = '';
    const mr = Number(value);
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.lookupVersion || Number(this.opdForm.get('patientId')!.value) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      const patch: Record<string, unknown> = {};
      const fields: Array<[string, unknown]> = [['patientName', name], ['age', patient.age], ['sex', patient.gender], ['phone', patient.phone], ['address', patient.address], ['drName', patient.drName]];
      fields.forEach(([key, fieldValue]) => { const control = this.opdForm.get(key)!; if ((control.value === '' || control.value == null) && fieldValue !== '' && fieldValue != null) patch[key] = fieldValue; });
      this.opdForm.patchValue(patch); this.matchedPatient = name;
    } catch { if (version === this.lookupVersion) this.matchedPatient = ''; }
  }

  onSubmit() {
    if (this.opdForm.invalid) {
      this.opdForm.markAllAsTouched();
      this.feedback.warning('Complete the highlighted OPD fields before saving.');
      return;
    }
    const value = this.opdForm.getRawValue();
    const timestamp = selectedDateTime(value.createdAt);
    const selected = timestamp ? new Date(timestamp) : null;
    const receiptDateTime = !this.edit || this.opdForm.get('createdAt')!.dirty
      ? { date: selected ? calendarValue(selected) : '', time: selected ? String(selected.getHours()).padStart(2, '0') + ':' + String(selected.getMinutes()).padStart(2, '0') : '' } : {};
    this.dialogRef.close({
      ...this.opdDetails, ...value,
      ...receiptDateTime, createdAt: timestamp,
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
