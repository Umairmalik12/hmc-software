import { Component, OnInit, Optional, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  title: string = "Haq Medical Center Login Page";
  hide: boolean = true;
  errorMessage = '';
  signingIn = false;
  restoring = true;
  changingPassword = false;
  successMessage = '';

  @ViewChild('f') form!: NgForm;

  constructor(
    private route: Router,
    private logIn: UserLoginService,
    private feedback: NotifyUpdateService = new NotifyUpdateService(),
    @Optional() private dialog: MatDialog | null = null
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      if (await this.logIn.restoreSession()) {
        await this.route.navigate(['home']);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to connect to Supabase.';
      this.feedback.error(this.errorMessage);
    } finally { this.restoring = false; }
  }

  async onSubmit() {
    if (this.signingIn || this.restoring || this.changingPassword) return;
    if (this.form.valid) {
      this.signingIn = true; this.errorMessage = ''; this.successMessage = '';
      const user = this.form.controls['username'].value;
      const pass = this.form.controls['password'].value;

      try {
        if (!await this.logIn.SignIn(user, pass)) throw new Error('Sign-in could not be completed. Please try again.');
        await this.route.navigate(['home']);
        this.feedback.success('Signed in successfully.', { title: 'Welcome back', route: '/patient' });
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Unable to sign in.';
        this.feedback.error(this.errorMessage);
      } finally { this.signingIn = false; }
    } else { this.form.form.markAllAsTouched(); this.feedback.warning('Enter a valid email address and password before signing in.'); }
  }

  openChangePassword(): void {
    if (!this.dialog || this.signingIn || this.restoring || this.changingPassword) return;
    this.errorMessage = ''; this.successMessage = ''; this.changingPassword = true;
    const reference = this.dialog.open(ChangePasswordDialogComponent, {
      width: '480px', maxWidth: '94vw', maxHeight: '94vh', panelClass: 'hmc-dialog-panel',
      autoFocus: 'input', data: { email: this.form?.controls['username']?.value || '' },
    });
    reference.afterClosed().subscribe((result?: { email: string }) => {
      this.changingPassword = false;
      if (!result) return;
      this.form.controls['username']?.setValue(result.email);
      this.form.controls['password']?.reset('');
      this.successMessage = 'Password updated successfully. Sign in using your new password.';
      this.feedback.success(this.successMessage, { title: 'Password changed', route: '/' });
    });
  }
}
