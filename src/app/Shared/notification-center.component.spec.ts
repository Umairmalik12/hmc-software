import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { FeedbackModule } from './feedback.module';
import { NotificationCenterComponent } from './notification-center.component';
import { NotifyUpdateService } from '../Services/notify-update.service';

describe('Header notification center', () => {
  let fixture: ComponentFixture<NotificationCenterComponent>;
  let feedback: NotifyUpdateService;
  let router: { url: string; navigateByUrl: jasmine.Spy };
  const panel = () => document.querySelector<HTMLElement>('#hmc-notifications')!;
  const button = (text: string) => Array.from(panel().querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim() === text)!;
  const settle = async () => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 40)); fixture.detectChanges(); };
  const open = async () => { (fixture.nativeElement.querySelector('.notification-bell') as HTMLButtonElement).click(); await settle(); };
  beforeEach(async () => {
    router = { url: '/patient', navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) };
    await TestBed.configureTestingModule({ imports: [FeedbackModule, NoopAnimationsModule], providers: [{ provide: Router, useValue: router }] }).compileComponents();
    feedback = TestBed.inject(NotifyUpdateService); fixture = TestBed.createComponent(NotificationCenterComponent); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); TestBed.inject(OverlayContainer).ngOnDestroy(); });

  it('updates the badge, highlights unread activity and supports individual and bulk read controls', async () => {
    feedback.success('Patient <b>Ali</b> saved.'); feedback.success('Token generated.'); await open();
    expect(fixture.nativeElement.querySelector('.notification-badge').textContent.trim()).toBe('2');
    expect(panel().querySelectorAll('.notification-item.unread').length).toBe(2); expect(panel().querySelector('b')).toBeNull();
    expect(panel().textContent).toContain('Patient <b>Ali</b> saved.'); expect(panel().querySelector('time')!.textContent).toMatch(/\d{2} \w{3} \d{4}, \d{1,2}:\d{2}/);
    button('Mark as read').click(); await settle(); expect(panel().querySelectorAll('.unread').length).toBe(1);
    button('Mark all as read').click(); await settle(); expect(panel().querySelectorAll('.unread').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull(); expect(button('Mark all as read').disabled).toBeTrue();
  });

  it('requires confirmation before clearing all activity and shows the empty state', async () => {
    feedback.success('Payment saved.'); await open(); const confirm = spyOn(window, 'confirm').and.returnValue(false);
    button('Clear all').click(); await settle(); expect(panel().querySelectorAll('.notification-item').length).toBe(1);
    confirm.and.returnValue(true); button('Clear all').click(); await settle(); expect(panel().querySelector('.notification-empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull();
  });

  it('marks an activated notification read, navigates to its page and restores focus to the bell', async () => {
    feedback.success('Token generated.', { route: '/patient-tokens' }); await open();
    panel().querySelector<HTMLButtonElement>('.notification-link')!.click(); await settle();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/patient-tokens'); expect(panel()).toBeNull();
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull(); expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.notification-bell'));
  });

  it('contains long content within the viewport, scrolls the recent list and closes on Escape', async () => {
    for (let index = 0; index < 14; index++) feedback.success('Patient ' + index + ' ' + 'LongPatientName'.repeat(12));
    await open(); const bounds = panel().getBoundingClientRect();
    expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth); expect(bounds.bottom).toBeLessThanOrEqual(innerHeight);
    expect(panel().scrollWidth).toBeLessThanOrEqual(panel().clientWidth + 1);
    const list = panel().querySelector<HTMLElement>('.notification-list')!; expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle(); expect(panel()).toBeNull();
  });
});
