import { Component, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { ShowalertService } from 'src/app/Services/showalert.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { IndexedDbService } from 'src/app/Services/indexed-db.service';

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

  constructor(
    private route: Router,
    private logIn: UserLoginService,
    private showAlert: ShowalertService,
    private dbService: IndexedDbService
  ) {}

  ngOnInit() {
    this.logIn.SignOut();
    this.initializeUsers();
  }

  private async initializeUsers() {
    const existing = await this.dbService.getItem<any[]>('hospitalUsers');

    if (!existing) {
      const users = [
        { username: 'admin', password: 'admin123' },
        { username: 'staff', password: '@Asdf112233' }
      ];
      await this.dbService.setItem('hospitalUsers', users);
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      const user = this.form.controls['username'].value;
      const pass = this.form.controls['password'].value;

      const res: boolean = await this.logIn.SignIn(user, pass);

      if (res) {
        this.route.navigate(['home']);
      } else {
        const msg = "Username or Password is Wrong !!";
        this.showAlert.showAlert(msg, "error", this.alertContainer);
      }
    }
  }
}
