import { TestBed } from '@angular/core/testing';
import { FeedbackModule } from './feedback.module';
import { AppFeedbackComponent } from './app-feedback.component';
import { NotifyUpdateService } from '../Services/notify-update.service';
import { LoadingService } from '../Services/loading.service';

describe('Global toast and loader presentation', () => {
  beforeEach(async () => { await TestBed.configureTestingModule({ imports: [FeedbackModule] }).compileComponents(); });
  it('renders safe, dismissible notifications within the viewport, including above modal overlays', () => {
    const fixture = TestBed.createComponent(AppFeedbackComponent); const notify = TestBed.inject(NotifyUpdateService);
    try {
      fixture.detectChanges(); notify.success('Patient <b>Ali</b> saved.'); notify.error('The record could not be deleted.'); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement; const stack = root.querySelector<HTMLElement>('.toast-stack')!;
      const bounds = stack.getBoundingClientRect(); expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(innerWidth + 1);
      expect(Number(getComputedStyle(stack).zIndex)).toBeGreaterThan(1000);
      expect(root.querySelector('[role="status"]')!.textContent).toContain('Patient <b>Ali</b> saved.'); expect(root.querySelector('b')).toBeNull();
      expect(root.querySelector('[role="alert"]')!.textContent).toContain('could not be deleted');
      root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')!.click(); fixture.detectChanges(); expect(root.querySelectorAll('app-alertbox').length).toBe(1);
    } finally { fixture.destroy(); }
  });
  it('shows and removes progress for concurrent tasks without blocking navigation or pointer input', () => {
    const fixture = TestBed.createComponent(AppFeedbackComponent); const loading = TestBed.inject(LoadingService);
    try {
      fixture.detectChanges(); const first = loading.begin('Loading records...'); const second = loading.begin('Saving record...', 2); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement; expect(root.textContent).toContain('Saving record...');
      expect(getComputedStyle(root.querySelector('.app-activity')!).pointerEvents).toBe('none');
      second(); fixture.detectChanges(); expect(root.textContent).toContain('Loading records...'); first(); fixture.detectChanges(); expect(root.querySelector('.app-activity')).toBeNull();
    } finally { fixture.destroy(); }
  });
});
