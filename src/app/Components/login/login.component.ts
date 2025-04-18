import { Component, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { UserLoginService } from 'src/app/Services/user-login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  title: string = "Haq Medical Center Login Page";
  hide: boolean = true;

  @ViewChild("placeholder", { read: ViewContainerRef }) alertContainer!: ViewContainerRef;
  @ViewChild('f') form!: NgForm;

  constructor(private route: Router,
    private logIn: UserLoginService,
    private showAlert: ShowalertService) {
  }

  ngOnInit() {
    this.logIn.SignOut();
    this.initializeUsers();
  }

  private initializeUsers() {
    if (!localStorage.getItem('hospitalUsers')) {
      const users = [
        { username: 'admin', password: 'admin123' },
        { username: 'drtanveer', password: 'tanveer' },
        { username: 'pharmacy', password: 'pharmacy' }
      ];
      localStorage.setItem('hospitalUsers', JSON.stringify(users));
    }
  }

  onSubmit() {
    if (this.form.valid) {

      let user = this.form.controls['username'].value;
      let pass = this.form.controls['password'].value;
      let res: boolean = this.logIn.SignIn(user, pass);

      if (res) this.route.navigate(['home']);
      else {
        let msg = " Username or Password is Wrong !!";
        this.showAlert.showAlert(msg, "error", this.alertContainer);
      }

    }
  }

}
