import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PrescriptionMedicineCatalogService } from 'src/app/Services/prescription-medicine-catalog.service';
import { requiredText } from 'src/app/Services/validators.service';
import { MEDICINE_STRENGTHS, medicineNameParts, normalizeMedicineStrength } from 'src/app/Models/medicine-strength';

@Component({
  selector: 'app-medicine-option-dialog',
  template: `<h2 mat-dialog-title><mat-icon>medication</mat-icon><span>{{ data.id ? 'Edit medicine' : data.addStrength ? 'Add medicine strength' : 'Add medicine' }}<small>Shared medicine catalogue</small></span></h2>
    <form (ngSubmit)="save()" novalidate><mat-dialog-content><div [attr.inert]="saving ? '' : null"><mat-form-field appearance="outline"><mat-label>Medicine name</mat-label><input matInput [formControl]="name" maxlength="160" [readonly]="!!data.addStrength" cdkFocusInitial><mat-error>Enter a medicine name, up to 160 characters</mat-error></mat-form-field>
    <mat-form-field appearance="outline"><mat-label>{{ data.addStrength ? 'Strength' : 'Strength (optional)' }}</mat-label><mat-select [formControl]="strength" [required]="!!data.addStrength" aria-label="Medicine strength"><mat-option value="">{{ data.addStrength ? 'Select strength' : 'Not specified' }}</mat-option><mat-option *ngFor="let value of strengths" [value]="value">{{ value }}</mat-option><mat-option [value]="customValue">Other strength...</mat-option></mat-select><mat-hint>For example, 500 mg, 1 g or 2 g</mat-hint><mat-error>Select a strength</mat-error></mat-form-field>
    <mat-form-field *ngIf="strength.value === customValue" appearance="outline"><mat-label>Other strength</mat-label><input matInput [formControl]="customStrength" maxlength="60" placeholder="e.g. 50 mcg or 0.5%"><mat-error>Enter a strength, up to 60 characters</mat-error></mat-form-field></div>
    <p class="form-note">Each strength is a separate medicine option. For example, 2SUM 1 g and 2SUM 2 g. Saved prescriptions and daily records keep their original names and doses.</p><p *ngIf="error" class="form-error" role="alert">{{ error }}</p></mat-dialog-content>
    <mat-dialog-actions><button mat-stroked-button type="button" (click)="cancel()" [disabled]="saving">Cancel</button><button [appBusy]="saving" mat-flat-button color="primary" type="submit" [disabled]="saving"><mat-icon>save</mat-icon>{{ saving ? 'Saving...' : 'Save medicine' }}</button></mat-dialog-actions></form>`,
  styles: [':host,form{display:flex;flex-direction:column;min-height:0}mat-form-field{width:100%}'],
})
export class MedicineOptionDialogComponent {
  name: FormControl<string>;
  readonly strengths = MEDICINE_STRENGTHS;
  readonly customValue = '__custom_strength__';
  readonly strength = new FormControl('', { nonNullable: true });
  readonly customStrength = new FormControl('', { nonNullable: true, validators: [requiredText, Validators.maxLength(60)] });
  saving = false;
  error = '';
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name?: string; id?: string; strength?: string; addStrength?: boolean }, private catalog: PrescriptionMedicineCatalogService, private ref: MatDialogRef<MedicineOptionDialogComponent>, private feedback: NotifyUpdateService = new NotifyUpdateService()) {
    const parts = medicineNameParts(data.name || '', data.strength);
    if (data.addStrength) this.strength.addValidators(Validators.required);
    this.name = new FormControl(parts.name, { nonNullable: true, validators: [requiredText, Validators.maxLength(160)] });
    const selected = this.strengths.find(value => value.toLowerCase() === normalizeMedicineStrength(parts.strength).toLowerCase());
    if (selected) this.strength.setValue(selected);
    else if (parts.strength) { this.strength.setValue(this.customValue); this.customStrength.setValue(parts.strength); }
  }
  cancel(): void { if (!this.saving) this.ref.close(); }
  async save(): Promise<void> {
    if (this.saving) return;
    if (this.name.invalid) { this.name.markAsTouched(); this.feedback.warning('Enter a valid medicine name before saving.'); return; }
    if (this.strength.invalid) { this.strength.markAsTouched(); this.feedback.warning('Select a strength for this medicine.'); return; }
    if (this.strength.value === this.customValue && this.customStrength.invalid) { this.customStrength.markAsTouched(); this.feedback.warning('Enter a valid medicine strength before saving.'); return; }
    this.saving = true; this.error = ''; this.ref.disableClose = true;
    try { const saved = await this.catalog.save(this.name.value, this.data.id, this.strength.value === this.customValue ? this.customStrength.value : this.strength.value); this.feedback.success(this.data.id ? 'Medicine updated successfully.' : 'Medicine added successfully.', { title: this.data.id ? 'Medicine updated' : 'Medicine added', route: '/prescription-medicines' }); this.ref.close(saved); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save this medicine. Please try again.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; this.ref.disableClose = false; }
  }
}
