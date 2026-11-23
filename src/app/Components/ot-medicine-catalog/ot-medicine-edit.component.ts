import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { emptyOtCatalogMedicine, OT_MEDICINE_TYPES, OT_MEDICINE_UNITS } from '../../Models/ot-medicine-catalog.model';
import { OtMedicineCatalogService } from '../../Services/ot-medicine-catalog.service';
import { requiredText } from '../../Services/validators.service';
import { MEDICINE_STRENGTHS, medicineNameParts } from '../../Models/medicine-strength';

@Component({
  selector: 'app-ot-medicine-edit',
  template: `<h2 mat-dialog-title><mat-icon>vaccines</mat-icon><span>{{ data.id ? 'Edit OT medicine' : data.fromId ? 'Add OT medicine strength' : 'Add OT medicine' }}<small>Medicine &amp; supply catalogue</small></span></h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate><mat-dialog-content>
      <p class="form-note">{{ data.fromId ? 'Choose another strength for this medicine. Each strength is a separate catalogue option.' : 'Only the medicine name is required.' }} Saved patient slips keep their original details.</p>
      <p *ngIf="loading" role="status" class="hmc-loading-state">Loading medicine...</p><p *ngIf="error" class="form-error" role="alert">{{ error }}</p>
      <button *ngIf="loadFailed" mat-stroked-button type="button" (click)="load()">Retry</button>
      <div class="form-grid" [attr.inert]="saving || loading || loadFailed ? '' : null">
        <mat-form-field appearance="outline"><mat-label>Medicine name</mat-label><input matInput formControlName="name" maxlength="160" [readonly]="!!data.fromId" required><mat-error>Enter a medicine name</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Generic name</mat-label><input matInput formControlName="genericName" maxlength="160"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Medicine category</mat-label><input matInput formControlName="category" maxlength="80" [matAutocomplete]="categoryOptions"><mat-autocomplete #categoryOptions="matAutocomplete"><mat-option *ngFor="let category of categories" [value]="category">{{ category }}</mat-option></mat-autocomplete></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Medicine type</mat-label><mat-select formControlName="type"><mat-option value="">Not specified</mat-option><mat-option *ngIf="form.value.type && !types.includes(form.value.type!)" [value]="form.value.type">{{ form.value.type }}</mat-option><mat-option *ngFor="let type of types" [value]="type">{{ type }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Strength</mat-label><input matInput formControlName="strength" maxlength="80" placeholder="e.g. 500 mg, 1 g, 2 g" [required]="!!data.fromId" [matAutocomplete]="strengthOptions"><mat-autocomplete #strengthOptions="matAutocomplete"><mat-option *ngFor="let strength of strengths" [value]="strength">{{ strength }}</mat-option></mat-autocomplete><mat-error>Enter a strength, up to 80 characters</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Unit</mat-label><input matInput formControlName="unit" maxlength="40" [matAutocomplete]="unitOptions"><mat-autocomplete #unitOptions="matAutocomplete"><mat-option *ngFor="let unit of units" [value]="unit">{{ unit }}</mat-option></mat-autocomplete></mat-form-field>
        <mat-form-field appearance="outline" class="form-span"><mat-label>Description</mat-label><textarea matInput formControlName="description" maxlength="1500" rows="3"></textarea></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Status</mat-label><mat-select formControlName="active"><mat-option [value]="true">Active</mat-option><mat-option [value]="false">Inactive</mat-option></mat-select><mat-hint>Only active medicines appear for new selections</mat-hint></mat-form-field>
      </div></mat-dialog-content><mat-dialog-actions><button mat-stroked-button type="button" (click)="cancel()" [disabled]="saving">Cancel</button><button [appBusy]="saving" mat-flat-button color="primary" type="submit" [disabled]="saving || loading || loadFailed"><mat-icon>save</mat-icon>{{ saving ? 'Saving...' : 'Save medicine' }}</button></mat-dialog-actions></form>`,
  styles: [':host,form{display:flex;flex-direction:column;min-height:0}.form-grid{margin-top:20px}mat-form-field{width:100%;min-width:0}'],
})
export class OtMedicineEditComponent implements OnInit {
  readonly types = OT_MEDICINE_TYPES;
  readonly strengths = MEDICINE_STRENGTHS;
  readonly units = OT_MEDICINE_UNITS;
  categories: string[] = [];
  form = this.fb.nonNullable.group({ name: ['', [requiredText, Validators.maxLength(160)]], genericName: ['', Validators.maxLength(160)], category: ['', Validators.maxLength(80)], type: ['', Validators.maxLength(60)], strength: ['', Validators.maxLength(80)], unit: ['', Validators.maxLength(40)], description: ['', Validators.maxLength(1500)], active: [true] });
  loading = false;
  loadFailed = false;
  saving = false;
  error = '';
  constructor(private fb: FormBuilder, private catalog: OtMedicineCatalogService, private ref: MatDialogRef<OtMedicineEditComponent>, @Inject(MAT_DIALOG_DATA) public data: { id?: string; fromId?: string }, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> {
    this.loading = true; this.loadFailed = false; this.error = '';
    try {
      const rows = await this.catalog.getAll(false, true);
      this.categories = Array.from(new Set(rows.map(item => item.category).filter(Boolean))).sort();
      if (this.data.id || this.data.fromId) {
        const existing = rows.find(item => item.id === (this.data.id || this.data.fromId));
        if (!existing) throw new Error('This medicine was removed. Close this form and refresh the list.');
        if (this.data.fromId) {
          this.form.controls.strength.addValidators(requiredText);
          this.form.patchValue({ ...existing, name: medicineNameParts(existing.name, existing.strength).name, strength: '', active: true });
        } else this.form.patchValue(existing);
      }
    } catch (error) { this.loadFailed = true; this.error = error instanceof Error ? error.message : 'Unable to load medicine details.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.loading = false; }
  }
  cancel(): void { if (!this.saving) this.ref.close(); }
  async save(): Promise<void> {
    if (this.saving || this.loading || this.loadFailed) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.feedback.warning('Enter a valid medicine name and check the highlighted fields.'); return; }
    this.saving = true; this.error = ''; this.ref.disableClose = true;
    try { const saved = await this.catalog.save({ ...emptyOtCatalogMedicine(), ...this.form.getRawValue(), id: this.data.id || '' }); this.feedback.success(this.data.id ? 'OT medicine updated successfully.' : 'OT medicine added successfully.', { title: this.data.id ? 'OT medicine updated' : 'OT medicine added', route: '/ot-medicines' }); this.ref.close(saved); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save this medicine. Please try again.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; this.ref.disableClose = false; }
  }
}
