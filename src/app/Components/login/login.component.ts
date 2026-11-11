import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { UserLoginService } from 'src/app/Services/user-login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  title: string = "Haq Medical Center Login Page";
  hide: boolean = true;
  errorMessage = '';

  @ViewChild('f') form!: NgForm;

  constructor(
    private route: Router,
    private logIn: UserLoginService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      if (await this.logIn.restoreSession()) {
        await this.route.navigate(['home']);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to connect to Supabase.';
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      const user = this.form.controls['username'].value;
      const pass = this.form.controls['password'].value;

      try {
        await this.logIn.SignIn(user, pass);
        this.route.navigate(['home']);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Unable to sign in.';
      }
    }
  }
}
