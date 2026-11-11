import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { UserLoginService } from '../user-login.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate{

  constructor(private user: UserLoginService,
              private router: Router) { }

  async canActivate(route: ActivatedRouteSnapshot,
                    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
      const authenticated = await this.user.isAuthenticated();
      return authenticated ? true : this.router.createUrlTree(['']);
  }
}
