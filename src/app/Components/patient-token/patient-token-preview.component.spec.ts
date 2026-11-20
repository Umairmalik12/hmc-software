import { PaymentSlipPreviewComponent } from '../payment/payment-slip-preview.component';
import { PaymentRecord } from '../payment/payment-record';
import { LabSlipPreviewComponent } from '../lab/lab-slip-preview.component';
import { LabPatient } from 'src/app/Models/lab.model';
import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { PatientTokenSlip, SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { Opd } from 'src/app/Models/opd.model';
import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ThermalReceiptPreviewComponent } from 'src/app/Shared/thermal-receipt-preview.component';
import { PatientTokenPreviewComponent } from './patient-token-preview.component';
import { OpdSlipComponent } from '../opdslip/opd-slip/opd-slip.component';
import { PatientTokenComponent } from './patient-token.component';
import { TimeFormatPipe } from 'src/app/Pipes/time-format.pipe';
import { ScrollPaginationDirective } from 'src/app/Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from 'src/app/Shared/scroll-list-footer.component';

describe('Thermal previews matching the printed receipt', () => {
  const token: PatientTokenSlip = { id: 5, tokenNumber: 'A12345678901234567890', sequence: 5, customerName: 'LongPatientName'.repeat(14) + ' <b>Ali</b>', date: '2026-11-19', time: '13:35', createdAt: '2026-11-19T08:35:00Z' };
  let previousPaper: string | null;
  let previousOpdPaper: string | null;
  let previousLabPaper: string | null;
  let previousPaymentPaper: string | null;
  const settle = async () => { TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 60)); TestBed.inject(ApplicationRef).tick(); };
  beforeEach(async () => {
    previousPaper = localStorage.getItem('hmc.tokenPaperWidth'); previousOpdPaper = localStorage.getItem('hmc.opdPaperWidth'); previousLabPaper = localStorage.getItem('hmc.labPaperWidth'); previousPaymentPaper = localStorage.getItem('hmc.paymentPaperWidth');
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, NoopAnimationsModule, FeedbackModule, MatDialogModule, MatButtonModule, MatIconModule],
      declarations: [PaymentSlipPreviewComponent, LabSlipPreviewComponent, PatientTokenPreviewComponent, OpdSlipComponent, ThermalReceiptPreviewComponent, PatientTokenComponent, TimeFormatPipe, ScrollPaginationDirective, ScrollListFooterComponent],
      providers: [{ provide: SupabaseDataService, useValue: { getAllPatientTokens: async () => [token], changes: new Subject<string>() } }],
    }).compileComponents();
  });
  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    for (const [key, value] of [['hmc.tokenPaperWidth', previousPaper], ['hmc.opdPaperWidth', previousOpdPaper], ['hmc.labPaperWidth', previousLabPaper], ['hmc.paymentPaperWidth', previousPaymentPaper]]) {
      if (value === null) localStorage.removeItem(key!); else localStorage.setItem(key!, value!);
    }
  });
  function assertMatching(preview: HTMLElement, printed: HTMLElement, printWindow: Window): void {
    expect(Math.abs(preview.getBoundingClientRect().width - printed.getBoundingClientRect().width)).toBeLessThan(1);
    expect(Math.abs(preview.getBoundingClientRect().height - printed.getBoundingClientRect().height)).toBeLessThan(1);
    expect(preview.textContent?.replace(/\s+/g, ' ').trim()).toBe(printed.textContent?.replace(/\s+/g, ' ').trim());
    const before = preview.querySelectorAll<HTMLElement>('.slip-brand,.slip-title,.slip-number,.slip-row,.slip-label,.slip-value,.slip-footer,.slip-thanks');
    const after = printed.querySelectorAll<HTMLElement>('.slip-brand,.slip-title,.slip-number,.slip-row,.slip-label,.slip-value,.slip-footer,.slip-thanks');
    expect(before.length).toBe(after.length);
    before.forEach((element, index) => {
      const actual = after[index];
      expect(Math.abs(element.getBoundingClientRect().width - actual.getBoundingClientRect().width)).withContext(element.className).toBeLessThan(1);
      expect(Math.abs(element.getBoundingClientRect().height - actual.getBoundingClientRect().height)).withContext(element.className).toBeLessThan(1);
      for (const property of ['font-size', 'font-family', 'font-weight', 'text-align', 'text-transform', 'line-height', 'letter-spacing', 'word-spacing']) expect(getComputedStyle(element).getPropertyValue(property)).withContext(element.className + ' ' + property).toBe(printWindow.getComputedStyle(actual).getPropertyValue(property));
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    });
    expect(preview.querySelectorAll('.thermal-paper-feed').length).toBe(1); expect(printed.querySelectorAll('.thermal-paper-feed').length).toBe(1);
    const thanks = preview.querySelectorAll<HTMLElement>('.slip-thanks');
    expect(thanks[thanks.length - 1].textContent).toBe('THANK YOU!');
    expect(preview.getBoundingClientRect().bottom - thanks[thanks.length - 1].getBoundingClientRect().bottom).toBeGreaterThan(10.9 * 96 / 25.4);
  }

  it('offers paper sizes on the token page and opens Print in the same size-selectable preview as OPD', async () => {
    localStorage.setItem('hmc.tokenPaperWidth', '58');
    const fixture = TestBed.createComponent(PatientTokenComponent);
    try {
      fixture.detectChanges(); await settle(); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const select = root.querySelector<HTMLSelectElement>('#token-paper-width')!;
      expect(Array.from(select.options).map(option => option.textContent?.trim())).toEqual(['58 mm', '80 mm']);
      select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true })); fixture.detectChanges();
      expect(fixture.componentInstance.paperWidth).toBe(80); expect(localStorage.getItem('hmc.tokenPaperWidth')).toBe('80');
      const popup = spyOn(window, 'open');
      Array.from(root.querySelectorAll<HTMLButtonElement>('td.actions button')).find(button => button.textContent?.trim() === 'Print')!.click();
      await settle();
      expect(popup).not.toHaveBeenCalled();
      const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
      const previewPaper = panel.querySelector<HTMLSelectElement>('select[aria-label="Patient token paper size"]')!;
      expect(previewPaper.selectedIndex).toBe(1);
      previewPaper.selectedIndex = 0; previewPaper.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Close')!.click();
      await settle(); fixture.detectChanges(); await Promise.resolve();
      expect(fixture.componentInstance.paperWidth).toBe(58); expect(select.selectedIndex).toBe(0);
    } finally { TestBed.inject(MatDialog).closeAll(); fixture.destroy(); }
  });
  for (const width of [58, 80] as const) {
    it(`uses identical ${width} mm token preview and print geometry, including the fitted token and complete footer`, async () => {
      const source = { ...token };
      const ref = TestBed.inject(MatDialog).open(PatientTokenPreviewComponent, { data: { record: source, paperWidth: width }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      source.customerName = 'Changed after opening'; await settle();
      const frame = document.createElement('iframe'); frame.style.width = '420px'; document.body.appendChild(frame);
      const popup = frame.contentWindow!; spyOn(window, 'open').and.returnValue(popup); spyOn(popup, 'focus'); spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      try {
        const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
        expect(panel.querySelector('b')).toBeNull();
        const preview = panel.querySelector<HTMLElement>('.thermal-receipt')!;
        expect(preview.textContent).toContain(token.customerName); expect(preview.textContent).toContain('19-11-2026'); expect(preview.textContent).toContain('1:35 PM');
        expect(panel.querySelector('mat-dialog-actions')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
        const content = panel.querySelector<HTMLElement>('mat-dialog-content')!; expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
        ref.componentInstance.print(); await printed;
        assertMatching(preview, popup.document.getElementById('patient-token-slip-print')!, popup);
        expect(localStorage.getItem('hmc.tokenPaperWidth')).toBe(String(width));
      } finally { frame.remove(); ref.close(); }
    });

    it(`uses identical ${width} mm OPD preview and print geometry for a continuous multi-slip job`, async () => {
      localStorage.setItem('hmc.opdPaperWidth', String(width));
      const visit = { patientId: 12, patientName: 'LongPatientName'.repeat(8), date: '2026-11-19', time: '13:35', sex: 'Male', drName: 'Doctor name'.repeat(8), followUp: 'Follow up instructions '.repeat(15) } as Opd;
      const ref = TestBed.inject(MatDialog).open(OpdSlipComponent, { data: { opds: [visit, { ...visit, patientId: 13 }] }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' }); await settle();
      const frame = document.createElement('iframe'); frame.style.width = '420px'; document.body.appendChild(frame);
      const popup = frame.contentWindow!; spyOn(window, 'open').and.returnValue(popup); spyOn(popup, 'focus'); spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      try {
        const preview = document.querySelector<HTMLElement>('.hmc-dialog-panel .thermal-receipt')!;
        ref.componentInstance.print(); await printed;
        assertMatching(preview, popup.document.getElementById('opd-thermal-print')!, popup);
      } finally { frame.remove(); ref.close(); }
    });
  }

  for (const width of [58, 80] as const) {
    it(`uses identical ${width} mm laboratory preview and print geometry with complete long test names and footer`, async () => {
      localStorage.setItem('hmc.labPaperWidth', String(width));
      const source: LabPatient = { patientId: 123, name: 'LongPatientName'.repeat(10) + ' <b>Ali</b>', phone: '0313 6076780',
        testName: Array.from({ length: 18 }, (_, index) => 'Long laboratory test ' + index).join(', '), price: 2500,
        suggestedDr: 'LongSurgeonName'.repeat(10), dateTime: new Date('2026-11-20T08:30:00Z') };
      const name = source.name;
      const ref = TestBed.inject(MatDialog).open(LabSlipPreviewComponent, { data: { record: source }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      source.name = 'Changed outside preview'; source.dateTime.setFullYear(2000); await settle();
      const frame = document.createElement('iframe'); frame.style.width = '420px'; document.body.appendChild(frame);
      const popup = frame.contentWindow!; spyOn(window, 'open').and.returnValue(popup); spyOn(popup, 'focus'); spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      try {
        const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
        const preview = panel.querySelector<HTMLElement>('.thermal-receipt')!;
        expect(preview.textContent).toContain(name); expect(preview.querySelector('b')).toBeNull(); expect(preview.textContent).toContain('20/11/2026');
        expect(panel.querySelector('mat-dialog-actions')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
        const content = panel.querySelector<HTMLElement>('mat-dialog-content')!; expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
        ref.componentInstance.print(); await printed;
        const receipt = popup.document.getElementById('lab-slip-print')!;
        assertMatching(preview, receipt, popup);
        expect(popup.document.body.textContent).toContain('Long laboratory test 17'); expect(popup.document.querySelector('b')).toBeNull();
        expect(popup.document.body.getBoundingClientRect().width * 25.4 / 96).toBeCloseTo(width, 1);
        expect(localStorage.getItem('hmc.labPaperWidth')).toBe(String(width));
      } finally { frame.remove(); ref.close(); }
    });
  }

  for (const width of [58, 80] as const) {
    it(`matches ${width} mm payment preview and print geometry after switching the paper control`, async () => {
      const source: PaymentRecord = { id: '123', patientName: 'LongPatientName'.repeat(10) + ' <b>Ali</b>', patientId: 'P-123', amount: 123.45,
        cashGiven: 150, cashReturn: 26.55, paymentMethod: 'cash', paymentStatus: width === 58 ? 'pending' : 'completed', staffName: 'LongCounterStaffName'.repeat(8),
        shiftName: 'Night shift '.repeat(10), shiftDate: '2026-11-20', counterName: 'Reception counter '.repeat(8), createdAt: '2026-11-20T08:30:00Z' };
      const expectedName = source.patientName; const expectedStatus = source.paymentStatus;
      const ref = TestBed.inject(MatDialog).open(PaymentSlipPreviewComponent, { data: { record: source, paperWidth: width === 58 ? 80 : 58 }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      source.patientName = 'Changed outside preview'; source.amount = 0; source.paymentStatus = 'failed'; await settle();
      const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
      const select = panel.querySelector<HTMLSelectElement>('select[aria-label="Payment receipt paper size"]')!;
      expect(Array.from(select.options).map(option => option.textContent?.trim())).toEqual(['58 mm', '80 mm']);
      select.selectedIndex = width === 58 ? 0 : 1; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
      const frame = document.createElement('iframe'); frame.style.width = '420px'; document.body.appendChild(frame);
      const popup = frame.contentWindow!; spyOn(window, 'open').and.returnValue(popup); spyOn(popup, 'focus'); spyOn(popup, 'close');
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      try {
        const preview = panel.querySelector<HTMLElement>('.thermal-receipt')!;
        expect(preview.textContent).toContain(expectedName); expect(preview.querySelector('b')).toBeNull();
        expect(preview.textContent).toContain('Rs 123.45'); expect(preview.textContent).toContain('PAYMENT ' + expectedStatus!.toUpperCase());
        expect(panel.querySelector('mat-dialog-actions')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight + 1);
        const content = panel.querySelector<HTMLElement>('mat-dialog-content')!; expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1);
        ref.componentInstance.print(); await printed;
        assertMatching(preview, popup.document.getElementById('payment-receipt')!, popup);
        expect(popup.document.body.textContent).toContain('LongCounterStaffName'); expect(popup.document.querySelector('b')).toBeNull();
        expect(popup.document.body.getBoundingClientRect().width * 25.4 / 96).toBeCloseTo(width, 1);
        expect(localStorage.getItem('hmc.paymentPaperWidth')).toBe(String(width));
      } finally { frame.remove(); ref.close(); }
    });
  }

  it('switches laboratory paper sizes immediately and remembers the choice on closing the modal', async () => {
    localStorage.removeItem('hmc.labPaperWidth');
    const record: LabPatient = { patientId: 1, name: 'Ali', phone: '', testName: 'CBC', price: 100, suggestedDr: '', dateTime: new Date('2026-11-20T08:30:00Z') };
    const config = { data: { record }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' };
    const ref = TestBed.inject(MatDialog).open(LabSlipPreviewComponent, config); await settle();
    expect(ref.componentInstance.paperWidth).toBe(80);
    const select = document.querySelector<HTMLSelectElement>('select[aria-label="Laboratory paper size"]')!;
    expect(Array.from(select.options).map(option => option.textContent?.trim())).toEqual(['58 mm', '80 mm']);
    select.selectedIndex = 0; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect(ref.componentInstance.paperWidth).toBe(58); expect(document.querySelector('.lab-preview-content .thermal-receipt')!.classList.contains('thermal-paper-58')).toBeTrue();
    expect(localStorage.getItem('hmc.labPaperWidth')).toBe('58'); ref.close(); await settle();
    const reopened = TestBed.inject(MatDialog).open(LabSlipPreviewComponent, config); await settle();
    expect(reopened.componentInstance.paperWidth).toBe(58); reopened.close();
  });

  it('switches paper size, refits the token and retains the selection for later reprints', async () => {
    const ref = TestBed.inject(MatDialog).open(PatientTokenPreviewComponent, { data: { record: token, paperWidth: 80 }, width: '480px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel' }); await settle();
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!; const select = panel.querySelector<HTMLSelectElement>('select[aria-label="Patient token paper size"]')!;
    const font = () => parseFloat(getComputedStyle(panel.querySelector('.slip-number')!).fontSize);
    const wide = font(); select.selectedIndex = 0; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    expect(ref.componentInstance.paperWidth).toBe(58); expect(localStorage.getItem('hmc.tokenPaperWidth')).toBe('58'); expect(font()).toBeLessThanOrEqual(wide);
    select.selectedIndex = 1; select.dispatchEvent(new Event('change', { bubbles: true })); await settle(); expect(ref.componentInstance.paperWidth).toBe(80); expect(font()).toBeCloseTo(wide, 1);
    ref.close();
  });
});
