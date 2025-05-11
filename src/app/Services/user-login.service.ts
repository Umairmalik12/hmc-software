import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class UserLoginService {
  private loggedIn: boolean = false;

  constructor(
    private cookie: CookieService,
    private indexedDbService: IndexedDbService
  ) {
    const temp = this.cookie.get('status');
    this.loggedIn = temp === 'true';
  }

  async SignIn(username: string, pass: string): Promise<boolean> {
    const users = await this.indexedDbService.getItem<any[]>('hospitalUsers') || [];

    const foundUser = users.find((user: any) =>
      user.username.toLowerCase() === username.toLowerCase() &&
      user.password.toLowerCase() === pass.toLowerCase()
    );

    if (foundUser) {
      console.log('for', foundUser);

      await this.indexedDbService.setItem('loginUser', foundUser.username);
      this.loggedIn = true;
      this.cookie.set('status', 'true', 1);
      return true;
    }

    return false;
  }

  async SignOut(): Promise<void> {
    this.cookie.delete('status');
    this.loggedIn = false;
    await this.indexedDbService.removeItem('loginUser');
  }

  get status(): boolean {
    return this.loggedIn;
  }

  async getLoginUser(): Promise<string | undefined> {
    return await this.indexedDbService.getItem<string>('loginUser');
  }
}
