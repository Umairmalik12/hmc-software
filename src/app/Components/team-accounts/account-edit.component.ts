import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FeedbackModule } from '../../Shared/feedback.module';
import { TeamAccount, TeamAccountService } from '../../Services/team-account.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';

@Component({ selector: 'app-account-edit', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatSelectModule, FeedbackModule],
  template: `<h2 mat-dialog-title>{{ data ? 'Update account' : 'Team signup' }}</h2>
  <form [formGroup]="form" (ngSubmit)="save()">
    <mat-dialog-content class="account-fields">
      <p class="account-note">{{ data ? 'Change the login email or set a new password. Leave the password blank to keep the current one.' : 'Create an account for a team member to sign in to HMC.' }}</p>
      <mat-form-field appearance="outline"><mat-label>Full name</mat-label><input matInput formControlName="name" autocomplete="name" maxlength="120"><mat-error>Enter the team member’s name</mat-error></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Login email</mat-label><input matInput type="email" formControlName="email" autocomplete="off" maxlength="254"><mat-error>Enter a valid email address</mat-error></mat-form-field>
      <mat-form-field *ngIf="!data" appearance="outline"><mat-label>Role</mat-label><mat-select formControlName="role"><mat-option value="staff">Staff</mat-option><mat-option value="admin">Admin</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>{{ data ? 'New password (optional)' : 'Password' }}</mat-label><input matInput [type]="hide ? 'password' : 'text'" formControlName="password" autocomplete="new-password" maxlength="128"><button mat-icon-button matIconSuffix type="button" (click)="hide = !hide" [attr.aria-label]="hide ? 'Show password' : 'Hide password'"><mat-icon>{{ hide ? 'visibility' : 'visibility_off' }}</mat-icon></button><mat-hint>8–128 characters</mat-hint><mat-error>Use 8–128 characters</mat-error></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Confirm password</mat-label><input matInput [type]="hide ? 'password' : 'text'" formControlName="confirmPassword" autocomplete="new-password" maxlength="128"></mat-form-field>
      <p *ngIf="error" class="form-error" role="alert">{{ error }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-stroked-button type="button" (click)="close()" [disabled]="saving">Cancel</button><button mat-flat-button color="primary" type="submit" [appBusy]="saving" [disabled]="saving">{{ data ? 'Save changes' : 'Create account' }}</button></mat-dialog-actions>
  </form>`,
  styles: ['.account-fields{display:grid;gap:12px}.account-fields mat-form-field{width:100%}.account-note{margin:0 0 8px;color:#627b84;font-size:12px;line-height:1.6}'] })
export class AccountEditComponent {
  saving = false; hide = true; error = '';
  form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]], email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]], role: ['staff'], password: ['', [Validators.minLength(8), Validators.maxLength(128)]], confirmPassword: [''] });
  constructor(private fb: FormBuilder, @Inject(MAT_DIALOG_DATA) public data: TeamAccount | null, private ref: MatDialogRef<AccountEditComponent>, private accounts: TeamAccountService, private feedback: NotifyUpdateService) {
    if (data) this.form.patchValue({ name: data.name, email: data.email, role: data.role });
    else {
      this.form.controls.password.addValidators(Validators.required);
      this.form.controls.password.updateValueAndValidity();
    }
  }
  close(): void { if (!this.saving) this.ref.close(); }
  async save(): Promise<void> {
    if (this.saving) return;
    this.error = '';
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    if (raw.password !== raw.confirmPassword) { this.error = 'The passwords do not match.'; return; }
    if (this.data && (raw.email.trim().toLowerCase() !== this.data.email.toLowerCase() || raw.password) && !window.confirm('Update the login credentials for ' + this.data.email + '?')) return;
    this.saving = true; this.ref.disableClose = true;
    try {
      await this.accounts.save({ name: raw.name.trim(), email: raw.email.trim(), ...(raw.password ? { password: raw.password } : {}), ...(!this.data ? { role: raw.role } : {}) }, this.data?.id);
      this.form.controls.password.reset(); this.form.controls.confirmPassword.reset();
      this.feedback.success(this.data ? 'Account updated successfully. Use the updated credentials on the next sign-in.' : 'Team account created successfully. The team member can now sign in.');
      this.ref.close(true);
    } catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save account.'; this.feedback.error(this.error); }
    finally { this.saving = false; this.ref.disableClose = false; }
  }
}
