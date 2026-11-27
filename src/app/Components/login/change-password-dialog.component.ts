import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UserLoginService } from '../../Services/user-login.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { FeedbackModule } from '../../Shared/feedback.module';

const matchingPasswords: ValidatorFn = control => {
  const password = control.get('newPassword')?.value;
  const confirmation = control.get('confirmPassword')?.value;
  return password && confirmation && password !== confirmation ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FeedbackModule],
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.css'],
})
export class ChangePasswordDialogComponent implements OnDestroy {
  readonly form = this.fb.nonNullable.group({
    email: [this.data?.email || '', [Validators.required, Validators.email]],
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmPassword: ['', Validators.required],
  }, { validators: matchingPasswords });
  saving = false;
  errorMessage = '';
  hideCurrent = true;
  hideNew = true;
  hideConfirm = true;
  private destroyed = false;

  constructor(private fb: FormBuilder, @Inject(MAT_DIALOG_DATA) private data: { email?: string } | null,
    private dialogRef: MatDialogRef<ChangePasswordDialogComponent>,
    private users: UserLoginService, private feedback: NotifyUpdateService) {}

  async submit(): Promise<void> {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.feedback.warning('Check the highlighted password fields before continuing.');
      return;
    }
    const { email, currentPassword, newPassword } = this.form.getRawValue();
    this.saving = true; this.errorMessage = ''; this.dialogRef.disableClose = true;
    try {
      await this.users.changePassword(email, currentPassword, newPassword);
      if (!this.destroyed) this.dialogRef.close({ email: email.trim() });
    } catch (error) {
      if (!this.destroyed) {
        this.errorMessage = error instanceof Error ? error.message : 'The password could not be updated. Please try again.';
        this.feedback.error(this.errorMessage);
      }
    } finally {
      this.saving = false;
      this.dialogRef.disableClose = false;
    }
  }

  cancel(): void { if (!this.saving) this.dialogRef.close(); }
  ngOnDestroy(): void { this.destroyed = true; this.form.reset(); }
}
