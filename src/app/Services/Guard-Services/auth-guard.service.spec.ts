import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { UserLoginService } from '../user-login.service';

import { AuthGuardService } from './auth-guard.service';

describe('AuthGuardService', () => {
  let service: AuthGuardService;
  let router: Router;
  let user: jasmine.SpyObj<UserLoginService>;

  beforeEach(async () => {
    user = jasmine.createSpyObj<UserLoginService>('UserLoginService', ['isAuthenticated']);
    user.isAuthenticated.and.returnValue(Promise.resolve(false));
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

  it('redirects unauthenticated users to login', async () => {
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    const result = await service.canActivate(route, state) as UrlTree;
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result)).toBe('/');
  });

  it('allows authenticated users', async () => {
    user.isAuthenticated.and.returnValue(Promise.resolve(true));
    const route = {} as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    expect(await service.canActivate(route, state)).toBeTrue();
  });
});
