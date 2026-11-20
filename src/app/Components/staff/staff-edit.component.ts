import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { StaffDutyAssignment, StaffRecord, STAFF_DESIGNATIONS, STAFF_SHIFTS, dutyTimingError, staffKey, uniqueStaffValues } from '../../Models/staff.model';
import { STAFF_COLLECTION, StaffService } from '../../Services/staff.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { requiredText } from '../../Services/validators.service';
import { Subscription } from 'rxjs';
import { STAFF_DUTY_CATALOG, StaffDutyCatalogService, StaffDutyOption } from '../../Services/staff-duty-catalog.service';

export interface StaffEditorData { record?: StaffRecord; designations?: string[]; duties?: string[]; shifts?: string[]; }

@Component({ selector: 'app-staff-edit', templateUrl: './staff-edit.component.html', styleUrls: ['./staff-edit.component.css'] })
export class StaffEditComponent implements OnInit, OnDestroy {
  readonly form: FormGroup;
  saving = false;
  error = '';
  submitted = false;
  duties: StaffDutyOption[] = [];
  dutiesLoading = false;
  dutiesError = '';
  private changes?: Subscription;
  private version = 0;
  private originalDuties = new WeakMap<AbstractControl, string>();
  constructor(private fb: FormBuilder, private ref: MatDialogRef<StaffEditComponent>, @Inject(MAT_DIALOG_DATA) public data: StaffEditorData,
    private staff: StaffService, private feedback: NotifyUpdateService, private dutyCatalog: StaffDutyCatalogService) {
    const record = data.record;
    this.form = fb.group({
      name: [record?.name || '', [Validators.required, requiredText, Validators.maxLength(120)]],
      designation: [record?.designation || '', Validators.maxLength(120)],
      employmentType: [record?.employmentType || '', Validators.pattern(/^(permanent|intern)$/)],
      active: [record?.active !== false],
      assignments: fb.array((record?.assignments || []).map(assignment => this.createAssignment(assignment))),
    });
  }
  ngOnInit(): void { void this.loadDuties(); this.changes = this.dutyCatalog.changes.subscribe(collection => { if (collection === STAFF_DUTY_CATALOG || collection === STAFF_COLLECTION) void this.loadDuties(); }); }
  ngOnDestroy(): void { this.version++; this.changes?.unsubscribe(); }
  async loadDuties(): Promise<void> {
    const version = ++this.version; this.dutiesLoading = true;
    try { const duties = await this.dutyCatalog.getAll(); if (version === this.version) { this.duties = duties; this.dutiesError = ''; for (const assignment of this.assignments.controls) assignment.get('duty')!.updateValueAndValidity({ emitEvent: false }); } }
    catch { if (version === this.version) this.dutiesError = 'Unable to load duties. Retry to refresh.'; }
    finally { if (version === this.version) this.dutiesLoading = false; }
  }
  get assignments(): FormArray { return this.form.get('assignments') as FormArray; }
  private createAssignment(value?: StaffDutyAssignment): FormGroup {
    const assignment = this.fb.group({
      duty: [value?.duty || '', [Validators.required, requiredText, Validators.maxLength(120), (control: AbstractControl) => {
        const key = staffKey(control.value);
        return !key || key === staffKey(value?.duty) || this.duties.some(option => staffKey(option.name) === key) ? null : { duty: true };
      }]],
      shift: [value?.shift || '', Validators.maxLength(60)],
      startTime: [value?.startTime || ''],
      endTime: [value?.endTime || ''],
    }, { validators: control => { const error = dutyTimingError(control.get('startTime')!.value, control.get('endTime')!.value); return error ? { timing: error } : null; } });
    this.originalDuties.set(assignment, value?.duty || ''); return assignment;
  }
  addDuty(): void { if (!this.saving) { this.assignments.push(this.createAssignment()); this.form.markAsDirty(); } }
  removeDuty(index: number): void { if (!this.saving) { this.assignments.removeAt(index); this.form.markAsDirty(); } }
  designationOptions(): string[] { return this.options([...STAFF_DESIGNATIONS, ...(this.data.designations || [])], this.form.get('designation')!.value); }
  dutyOptions(control: AbstractControl): string[] { return uniqueStaffValues([...this.duties.map(option => option.name), this.originalDuties.get(control) || '']); }
  selectDuty(control: AbstractControl, value: string): void { const duty = control.get('duty')!; duty.setValue(value); duty.markAsDirty(); duty.markAsTouched(); this.form.markAsDirty(); }
  shiftOptions(control: AbstractControl): string[] { return this.options([...STAFF_SHIFTS, ...(this.data.shifts || [])], control.get('shift')!.value); }
  private options(names: string[], query: string): string[] { return uniqueStaffValues(names).filter(name => staffKey(name).includes(staffKey(query))); }
  timing(control: AbstractControl): string { return dutyTimingError(control.get('startTime')!.value, control.get('endTime')!.value); }
  overnight(control: AbstractControl): boolean { const { startTime, endTime } = control.value; return !!startTime && !!endTime && !this.timing(control) && endTime < startTime; }
  async save(): Promise<void> {
    if (this.saving) return;
    const changedDuty = this.assignments.controls.some(assignment => staffKey(assignment.get('duty')!.value) !== staffKey(this.originalDuties.get(assignment)));
    if (changedDuty && (this.dutiesLoading || this.dutiesError)) { this.feedback.warning('Load the duty list before assigning a new duty. Use Retry to refresh.'); return; }
    this.submitted = true; this.error = '';
    if (this.form.invalid) { this.form.markAllAsTouched(); this.feedback.warning('Complete the highlighted staff and duty fields.'); return; }
    this.saving = true;
    const draft = this.form.getRawValue(); this.form.disable({ emitEvent: false });
    try {
      const record = await this.staff.save(draft, this.data.record?.id);
      this.feedback.success(this.data.record ? 'Staff updated successfully.' : 'Staff added successfully.', { route: '/staff' });
      this.ref.close(record);
    } catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save the staff record.'; this.feedback.error(this.error); }
    finally { this.saving = false; this.form.enable({ emitEvent: false }); }
  }
  close(): void { if (!this.saving && (!this.form.dirty || window.confirm('Discard unsaved staff changes?'))) this.ref.close(); }
}
