import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let user: jasmine.SpyObj<UserLoginService>;
  beforeEach(async () => {
    user = jasmine.createSpyObj<UserLoginService>('user', ['restoreSession', 'SignIn']);
    user.restoreSession.and.resolveTo(false);
    user.SignIn.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, RouterTestingModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, NoopAnimationsModule],
      declarations: [LoginComponent], providers: [{ provide: UserLoginService, useValue: user }],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the hospital branding and email/password sign-in fields', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h1')!.textContent).toBe('Haq Medical Center');
    expect(element.querySelector('input[name="username"]')).not.toBeNull();
    expect(element.querySelector('input[name="password"]')).not.toBeNull();
    expect(element.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('toggles password visibility without submitting the form', () => {
    const submit = spyOn(fixture.componentInstance, 'onSubmit');
    const button = fixture.nativeElement.querySelector('button[aria-label="Show password"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="password"]').type).toBe('text');
    expect(submit).not.toHaveBeenCalled();
  });

  it('navigates to the workspace after successful authentication', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.form.controls['username'].setValue('staff@example.com');
    fixture.componentInstance.form.controls['password'].setValue('test-password');
    await fixture.componentInstance.onSubmit();
    expect(user.SignIn).toHaveBeenCalledWith('staff@example.com', 'test-password');
    expect(navigate).toHaveBeenCalledWith(['home']);
  });

  it('keeps the form available and reports authentication failures', async () => {
    user.SignIn.and.rejectWith(new Error('Invalid credentials'));
    fixture.componentInstance.form.controls['username'].setValue('staff@example.com');
    fixture.componentInstance.form.controls['password'].setValue('test-password');
    await fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid credentials');
  });
});
