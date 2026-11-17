import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { PaymentComponent } from './payment.component';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { memoryDb } from 'src/app/testing/memory-db';
import { MatDialogModule } from '@angular/material/dialog';
import { RecordPreviewDirective } from '../record-details/record-preview.directive';

describe('Payment screen and counter register layout', () => {
  beforeEach(async () => {
    const { db, collections } = memoryDb();
    collections.set('payments', new Map(Array.from({ length: 65 }, (_, id) => [String(id), { id: String(id), patientName: 'Patient ' + id,
      amount: 100, cashGiven: 150, cashReturn: 50, paymentMethod: 'cash', paymentStatus: 'completed', staffName: 'Ayesha', shiftName: 'Night', shiftDate: '2026-11-16', createdAt: '2026-11-17T00:30:00Z' }])));
    await TestBed.configureTestingModule({
      imports: [FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatCardModule, MatInputModule, MatSelectModule, MatIconModule, MatTableModule, MatButtonModule, MatDialogModule],
      declarations: [PaymentComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: db }, { provide: UserLoginService, useValue: {
        getLoginUser: async () => 'staff', getStaffIdentity: async () => ({ id: 'layout-test-staff', name: 'Ayesha', email: 'ayesha@example.test' }),
      } }],
    }).compileComponents();
  });

  it('fits the form and collection cards within the viewport, while the register scrolls separately', async () => {
    const fixture = TestBed.createComponent(PaymentComponent);
    try {
      fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 80)); fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('[formControlName="staffName"]')).not.toBeNull();
      expect(root.querySelector('[formControlName="shiftName"]')).not.toBeNull();
      expect(root.querySelector('[formControlName="staffName"]')!.getAttribute('maxlength')).toBe('120');
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      for (const selector of ['.payment-entry-layout', '.payment-filters', '.collection-summary', '.checkout-summary']) {
        const element = root.querySelector<HTMLElement>(selector)!;
        expect(element.scrollWidth).withContext(selector).toBeLessThanOrEqual(element.clientWidth + 1);
      }
      expect(root.querySelector('.collection-summary')!.textContent).toContain('6,500.00');
      expect(root.querySelectorAll('button[aria-label="Delete payment"]').length).toBe(0);
      const register = root.querySelector<HTMLElement>('.table-scroll-container')!;
      expect(register.scrollHeight).toBeGreaterThan(register.clientHeight);
      expect(root.querySelectorAll('tr.mat-mdc-row').length).toBe(20);
      register.scrollTop = register.scrollHeight; register.dispatchEvent(new Event('scroll'));
      await new Promise(resolve => setTimeout(resolve, 50)); fixture.detectChanges();
      expect(root.querySelectorAll('tr.mat-mdc-row').length).toBe(40);
      fixture.componentInstance.staffFilter = '__unrecorded__'; fixture.componentInstance.applyPaymentFilter(); fixture.detectChanges();
      expect(root.querySelector('.list-empty')!.textContent).toContain('No payments match');
      expect(root.querySelector('.collection-summary')!.textContent).toContain('0.00');
    } finally { fixture.destroy(); }
  });
});
