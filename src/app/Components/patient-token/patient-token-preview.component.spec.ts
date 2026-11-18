import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { Opd } from 'src/app/Models/opd.model';
import { FeedbackModule } from 'src/app/Shared/feedback.module';
import { ThermalReceiptPreviewComponent } from 'src/app/Shared/thermal-receipt-preview.component';
import { PatientTokenPreviewComponent } from './patient-token-preview.component';
import { OpdSlipComponent } from '../opdslip/opd-slip/opd-slip.component';

describe('Thermal previews matching the printed receipt', () => {
  const token: PatientTokenSlip = { id: 5, tokenNumber: 'A12345678901234567890', sequence: 5, customerName: 'LongPatientName'.repeat(14) + ' <b>Ali</b>', date: '2026-11-19', time: '13:35', createdAt: '2026-11-19T08:35:00Z' };
  let previousPaper: string | null;
  let previousOpdPaper: string | null;
  const settle = async () => { TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 60)); TestBed.inject(ApplicationRef).tick(); };
  beforeEach(async () => {
    previousPaper = localStorage.getItem('hmc.tokenPaperWidth'); previousOpdPaper = localStorage.getItem('hmc.opdPaperWidth');
    await TestBed.configureTestingModule({ imports: [CommonModule, FormsModule, NoopAnimationsModule, FeedbackModule, MatDialogModule, MatButtonModule, MatIconModule], declarations: [PatientTokenPreviewComponent, OpdSlipComponent, ThermalReceiptPreviewComponent] }).compileComponents();
  });
  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    for (const [key, value] of [['hmc.tokenPaperWidth', previousPaper], ['hmc.opdPaperWidth', previousOpdPaper]]) {
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
