import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PrescriptionMedicineCatalogService } from 'src/app/Services/prescription-medicine-catalog.service';
import { requiredText } from 'src/app/Services/validators.service';

@Component({
  selector: 'app-medicine-option-dialog',
  template: `<h2 mat-dialog-title><mat-icon>medication</mat-icon><span>{{ data.id ? 'Edit medicine' : 'Add medicine' }}<small>Shared medicine catalogue</small></span></h2>
    <form (ngSubmit)="save()" novalidate><mat-dialog-content><mat-form-field appearance="outline"><mat-label>Medicine name</mat-label><input matInput [formControl]="name" maxlength="160" cdkFocusInitial><mat-error>Enter a medicine name, up to 160 characters</mat-error></mat-form-field><p class="form-note">Catalogue changes apply to future selections. Saved prescriptions and daily records keep their original medicine names and doses.</p><p *ngIf="error" class="form-error" role="alert">{{ error }}</p></mat-dialog-content>
    <mat-dialog-actions><button mat-stroked-button type="button" (click)="cancel()" [disabled]="saving">Cancel</button><button [appBusy]="saving" mat-flat-button color="primary" type="submit" [disabled]="saving"><mat-icon>save</mat-icon>{{ saving ? 'Saving...' : 'Save medicine' }}</button></mat-dialog-actions></form>`,
  styles: [':host,form{display:flex;flex-direction:column;min-height:0}mat-form-field{width:100%}'],
})
export class MedicineOptionDialogComponent {
  name: FormControl<string>;
  saving = false;
  error = '';
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name?: string; id?: string }, private catalog: PrescriptionMedicineCatalogService, private ref: MatDialogRef<MedicineOptionDialogComponent>, private feedback: NotifyUpdateService = new NotifyUpdateService()) {
    this.name = new FormControl(data.name || '', { nonNullable: true, validators: [requiredText, Validators.maxLength(160)] });
  }
  cancel(): void { if (!this.saving) this.ref.close(); }
  async save(): Promise<void> {
    if (this.saving) return;
    if (this.name.invalid) { this.name.markAsTouched(); return; }
    this.saving = true; this.error = ''; this.ref.disableClose = true;
    try { const saved = await this.catalog.save(this.name.value, this.data.id); this.feedback.success(this.data.id ? 'Medicine updated successfully.' : 'Medicine added successfully.'); this.ref.close(saved); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save this medicine. Please try again.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; this.ref.disableClose = false; }
  }
}
