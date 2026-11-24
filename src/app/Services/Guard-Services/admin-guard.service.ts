import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { UserLoginService } from '../user-login.service';

@Injectable({ providedIn: 'root' })
export class AdminGuardService implements CanActivate {
  constructor(private users: UserLoginService, private router: Router) {}
  async canActivate(): Promise<boolean | UrlTree> {
    try { return await this.users.getLoginUser() === 'admin' ? true : this.router.createUrlTree(['/home']); }
    catch { return this.router.createUrlTree(['/']); }
  }
}
