import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
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
import { SearchableSelectComponent } from 'src/app/Shared/searchable-select.component';
import { StaffService } from 'src/app/Services/staff.service';

describe('Payment screen and counter register layout', () => {
  beforeEach(async () => {
    localStorage.removeItem('hmc.paymentCounter.layout-test-staff');
    const { db, collections } = memoryDb();
    collections.set('staffDetails', new Map([
      ['1', { id: '1', name: 'Ayesha', active: true, assignments: [] }],
      ['2', { id: '2', name: 'Bilal', active: true, assignments: [] }],
      ['3', { id: '3', name: 'Former staff', active: false, assignments: [] }],
    ]));
    collections.set('payments', new Map(Array.from({ length: 65 }, (_, id) => [String(id), { id: String(id), patientName: 'Patient ' + id,
      amount: 100, cashGiven: 150, cashReturn: 50, paymentMethod: 'cash', paymentStatus: 'completed', staffName: 'Ayesha', shiftName: 'Night', shiftDate: '2026-11-16', createdAt: '2026-11-17T00:30:00Z' }])));
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, FeedbackModule, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatCardModule, MatInputModule, MatSelectModule, MatIconModule, MatTableModule, MatButtonModule, MatDialogModule],
      declarations: [PaymentComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordPreviewDirective],
      providers: [{ provide: SupabaseDataService, useValue: db }, { provide: UserLoginService, useValue: {
        getLoginUser: async () => 'staff', getStaffIdentity: async () => ({ id: 'layout-test-staff', name: 'Ayesha', email: 'ayesha@example.test' }),
      } }],
    }).compileComponents();
  });
  afterEach(() => localStorage.removeItem('hmc.paymentCounter.layout-test-staff'));

  it('fits the form and collection cards within the viewport, while the register scrolls separately', async () => {
    const fixture = TestBed.createComponent(PaymentComponent);
    try {
      fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 80)); fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('.counter-staff-select input[role="combobox"]')).not.toBeNull();
      expect(root.querySelector('[formControlName="shiftName"]')).not.toBeNull();
      expect(root.querySelector('#payment-staff-names')).toBeNull();
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
  it('searches staff from the master list, saves the selected name and refreshes options after staff changes', async () => {
    const fixture = TestBed.createComponent(PaymentComponent);
    const settle = async () => { fixture.detectChanges(); await new Promise(resolve => setTimeout(resolve, 50)); fixture.detectChanges(); };
    try {
      await settle(); const page = fixture.componentInstance; const root: HTMLElement = fixture.nativeElement;
      const picker = root.querySelector<HTMLElement>('.counter-staff-select')!;
      (picker.querySelector('button[aria-label="Browse counter staff name"]') as HTMLButtonElement).click(); await settle();
      let labels = Array.from(document.querySelectorAll<HTMLElement>('.hmc-catalog-options .hmc-option-label'));
      expect(labels.map(option => option.textContent?.trim())).toContain('Bilal'); expect(labels.map(option => option.textContent?.trim())).not.toContain('Former staff');
      const input = picker.querySelector('input')!; input.value = 'Bil'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
      expect(page.paymentForm.get('staffName')!.value).toBe('Ayesha');
      labels = Array.from(document.querySelectorAll<HTMLElement>('.hmc-catalog-options .hmc-option-label'));
      labels.find(option => option.textContent?.trim() === 'Bilal')!.closest('mat-option')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); await settle();
      expect(page.paymentForm.get('staffName')!.value).toBe('Bilal'); page.paymentForm.patchValue({ patientName: 'Selected staff patient', amount: 50, shiftName: 'Evening', shiftDate: '2026-11-20' }); page.printAfterSave = false;
      await page.processPayment(); await settle();
      const stored = await TestBed.inject(SupabaseDataService).getItem<any[]>('payments') || []; expect(stored.find(item => item.patientName === 'Selected staff patient').staffName).toBe('Bilal');
      const added = await TestBed.inject(StaffService).save({ name: 'Zara', designation: 'Counter staff', employmentType: 'intern', active: true, assignments: [] }); await settle();
      expect(page.staffEntryOptions).toContain('Zara'); await TestBed.inject(StaffService).delete(added.id); await settle(); expect(page.staffEntryOptions).not.toContain('Zara');
      page.selectStaffFilter(page.unrecordedStaffLabel); expect(page.staffFilter).toBe('__unrecorded__'); page.selectStaffFilter('Ayesha'); expect(page.filteredPayments.length).toBe(65);
    } finally { fixture.destroy(); }
  });
});
