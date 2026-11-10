import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { UserLoginService } from '../user-login.service';

import { AuthGuardService } from './auth-guard.service';

describe('AuthGuardService', () => {
  let service: AuthGuardService;
  let router: Router;
  let user: { status: boolean };

  beforeEach(async () => {
    user = { status: false };
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: UserLoginService, useValue: user }]
    })
    .compileComponents();
    service = TestBed.inject(AuthGuardService);
    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('redirects unauthenticated users to login',()=>{
    let route!: ActivatedRouteSnapshot;
    let state!: RouterStateSnapshot;
    const result = service.canActivate(route, state) as UrlTree;
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result)).toBe('/');
  });

  it('allows authenticated users', () => {
    user.status = true;
    let route!: ActivatedRouteSnapshot;
    let state!: RouterStateSnapshot;
    expect(service.canActivate(route, state)).toBeTrue();
  });
});
