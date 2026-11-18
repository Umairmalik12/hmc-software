import { printThermal } from './thermal-print';
import { buildLabReceipt } from '../lab/lab-thermal-receipt';
import { buildPaymentReceipt } from '../payment/payment-receipt';
import { buildDailyMedicineReceipt, DAILY_MEDICINE_RECEIPT_CSS } from '../medicine/daily-medicine-receipt';
import { buildOpdThermalPrint, OPD_THERMAL_CSS } from '../opdslip/opd-slip/opd-thermal-receipt';
import { Opd } from 'src/app/Models/opd.model';

describe('printThermal layout', () => {
  let frame: HTMLIFrameElement;
  let popup: Window;

  beforeEach(() => {
    // Use a real browser document so font metrics, wrapping, and physical CSS
    // units are exercised without opening a print dialog or using a printer.
    frame = document.createElement('iframe');
    frame.style.width = '420px';
    frame.style.height = '640px';
    document.body.appendChild(frame);
    popup = frame.contentWindow!;
    spyOn(window, 'open').and.returnValue(popup);
    spyOn(popup, 'focus');
    spyOn(popup, 'close');
  });

  afterEach(() => frame.remove());

  it('uses the notification system when pop-ups are blocked without opening a native alert', () => {
    (window.open as jasmine.Spy).and.returnValue(null);
    const feedback = jasmine.createSpyObj('feedback', ['error', 'info']); const alert = spyOn(window, 'alert');
    expect(printThermal('<section></section>', 58, 'patient-token-slip-print', feedback)).toBeFalse();
    expect(feedback.error).toHaveBeenCalledWith('Allow pop-ups for this site to print the receipt.'); expect(feedback.info).not.toHaveBeenCalled(); expect(alert).not.toHaveBeenCalled();
  });

  const receipt = (name: string, token: string): string => `
    <section id="patient-token-slip-print">
      <div class="slip-brand">HAQ MEDICAL CENTER</div>
      <div class="slip-hospital">Hospital</div>
      <div class="slip-rule"></div>
      <div class="slip-title">PATIENT TOKEN</div>
      <div class="slip-number">${token}</div>
      <div class="slip-rule"></div>
      <div class="slip-row"><span class="slip-label">Patient</span><span class="slip-value">${name}</span></div>
      <div class="slip-row"><span class="slip-label">Date</span><span class="slip-value">16-11-2026</span></div>
      <div class="slip-row"><span class="slip-label">Time</span><span class="slip-value">12:35 PM</span></div>
      <div class="slip-rule"></div>
      <div class="slip-footer">PLEASE WAIT FOR YOUR TURN</div>
      <div class="slip-thanks">THANK YOU!</div>
    </section>`;

  for (const width of [58, 80] as const) {
    it(`prints complete OPD slips on ${width} mm paper with centered headings and feed after the footer`, async () => {
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      const visit = { patientId: 42, patientName: 'LongPatientName'.repeat(12), date: '2026-11-18', time: '13:35', sex: 'Male', drName: 'LongDoctorName'.repeat(12), followUp: 'Review follow-up instructions '.repeat(20) } as Opd;
      printThermal('<style>' + OPD_THERMAL_CSS + '</style>' + buildOpdThermalPrint([visit, { ...visit, patientId: 43, patientName: 'Another patient', drName: 'Dr Haq', followUp: 'After 2 weeks' }]), width, 'opd-thermal-print');
      await printed;
      const doc = popup.document, slip = doc.getElementById('opd-thermal-print')!;
      expect(doc.querySelectorAll('.opd-thermal-receipt').length).toBe(2); expect(doc.querySelectorAll('.opd-thermal-feed').length).toBe(1);
      const bounds = slip.getBoundingClientRect(), paper = doc.body.getBoundingClientRect();
      expect(bounds.left - paper.left).toBeCloseTo(paper.right - bounds.right, 1);
      for (const element of Array.from(doc.querySelectorAll<HTMLElement>('.slip-value,.slip-label,.slip-brand,.slip-title,.slip-thanks'))) expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
      const headings = doc.querySelectorAll<HTMLElement>('.slip-brand,.slip-title,.slip-thanks');
      headings.forEach(heading => expect(popup.getComputedStyle(heading).textAlign).toBe('center'));
      expect(doc.body.textContent).toContain(visit.patientName); expect(doc.body.textContent).toContain(visit.followUp); expect(doc.body.textContent).toContain('1:35 PM');
      const followUpLabel = Array.from(doc.querySelectorAll<HTMLElement>('.slip-label')).find(label => label.textContent === 'Follow-up')!;
      expect(followUpLabel.getBoundingClientRect().height).toBeLessThanOrEqual(parseFloat(popup.getComputedStyle(followUpLabel).lineHeight) + 1);
      const thanks = doc.querySelectorAll('.slip-thanks'); expect(bounds.bottom - thanks[thanks.length - 1].getBoundingClientRect().bottom).toBeGreaterThan(10 * 96 / 25.4);
      expect(slip.scrollWidth).toBeLessThanOrEqual(slip.clientWidth + 1);
      const size = doc.head.lastElementChild!.textContent!.match(/size:(\d+)mm (\d+)mm/)!;
      expect(Number(size[1])).toBe(width); expect(Number(size[2]) * 96 / 25.4).toBeGreaterThan(bounds.bottom);
    });

    it(`prints all daily medicines and the complete room label on ${width} mm paper without clipping`, async () => {
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      const medicines = Array.from({ length: 30 }, (_, index) => ({ medicineName: 'Medicine ' + index + ' / ' + 'LongMedicineName'.repeat(5), quantity: index + 1 }));
      const html = buildDailyMedicineReceipt({ medicineId: 42, patientName: 'LongPatientName'.repeat(5), roomNo: 'General Ward Bed 1 - ' + 'LongRoomLabel'.repeat(5), doctorName: 'Dr Haq', createdAt: '2026-11-17T06:30:00Z', medicines });
      printThermal('<style>' + DAILY_MEDICINE_RECEIPT_CSS + '</style>' + html, width, 'daily-medicine-receipt'); await printed;
      const doc = popup.document, slip = doc.getElementById('daily-medicine-receipt')!;
      expect(doc.querySelectorAll('.medicine-line:not(.medicine-heading)').length).toBe(30);
      expect(popup.getComputedStyle(slip).fontFamily).toContain('Segoe UI');
      expect(doc.querySelector('.room-row .slip-value')!.textContent).toContain('General Ward Bed 1');
      const roomLabel = doc.querySelector<HTMLElement>('.room-row .slip-label')!;
      expect(roomLabel.getBoundingClientRect().height).toBeLessThanOrEqual(parseFloat(popup.getComputedStyle(roomLabel).lineHeight) + 1);
      const rows = Array.from(doc.querySelectorAll<HTMLElement>('.medicine-line:not(.medicine-heading)'));
      const quantityRight = rows[0].querySelector('.medicine-quantity')!.getBoundingClientRect().right;
      rows.forEach((row, index) => {
        expect(row.querySelector('.medicine-index')!.textContent).toBe(String(index + 1));
        expect(row.querySelector('.medicine-name')!.textContent).toBe(medicines[index].medicineName);
        expect(row.querySelector('.medicine-quantity')!.textContent).toBe(String(medicines[index].quantity));
        expect(row.querySelector('.medicine-quantity')!.getBoundingClientRect().right).toBeCloseTo(quantityRight, 1);
      });
      for (const element of Array.from(doc.querySelectorAll<HTMLElement>('.slip-value,.medicine-line>span'))) expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
      expect(slip.scrollWidth).toBeLessThanOrEqual(slip.clientWidth + 1);
      const bounds = slip.getBoundingClientRect(), paper = doc.body.getBoundingClientRect();
      expect(bounds.left - paper.left).toBeCloseTo(paper.right - bounds.right, 1);
      const thanks = doc.querySelector('.slip-thanks')!; expect(thanks.textContent).toBe('THANK YOU!');
      expect(bounds.bottom - thanks.getBoundingClientRect().bottom).toBeGreaterThan(10 * 96 / 25.4);
      const page = doc.head.lastElementChild!.textContent!.match(/size:(\d+)mm (\d+)mm/)!;
      expect(Number(page[1])).toBe(width); expect(Number(page[2]) * 96 / 25.4).toBeGreaterThan(bounds.bottom);
    });

    it(`prints a complete ${width} mm payment receipt including long staff and shift names`, async () => {
      const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
      printThermal(buildPaymentReceipt({ id: '42', patientName: 'LongPatientName'.repeat(10), amount: 123.45, cashGiven: 150, cashReturn: 26.55,
        paymentMethod: 'cash', paymentStatus: 'completed', staffName: 'LongCounterStaffName'.repeat(8), shiftName: 'Night shift '.repeat(6), shiftDate: '2026-11-16', counterName: 'Reception 1', createdAt: '2026-11-17T00:30:00Z' }), width, 'payment-receipt');
      await printed;
      const doc = popup.document, slip = doc.getElementById('payment-receipt')!;
      const bounds = slip.getBoundingClientRect();
      expect(bounds.left - doc.body.getBoundingClientRect().left).toBeCloseTo(doc.body.getBoundingClientRect().right - bounds.right, 1);
      for (const value of Array.from(doc.querySelectorAll<HTMLElement>('.slip-value'))) expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1);
      expect(doc.body.textContent).toContain('LongCounterStaffName'); expect(doc.body.textContent).toContain('Night shift');
      const thanks = doc.querySelector('.slip-thanks')!;
      expect(thanks.textContent).toBe('THANK YOU!'); expect(bounds.bottom - thanks.getBoundingClientRect().bottom).toBeGreaterThan(10 * 96 / 25.4);
      expect(slip.scrollWidth).toBeLessThanOrEqual(slip.clientWidth + 1);
    });
  }

  for (const width of [58, 80] as const) {
    for (const longContent of [false, true]) {
      it(`centers ${width} mm receipts and feeds past the footer (${longContent ? 'long' : 'short'} content)`, async () => {
        const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
        const name = longContent ? 'Muhammad '.repeat(12) + 'Khan' : 'Isfaq';
        const tokenNumber = longContent ? 'A12345678901234567890' : 'A003';

        printThermal(receipt(name, tokenNumber), width);
        await printed;

        const doc = popup.document;
        const slip = doc.getElementById('patient-token-slip-print')!;
        const bounds = slip.getBoundingClientRect();
        const paper = doc.body.getBoundingClientRect();
        const mm = 96 / 25.4;
        expect(paper.width / mm).toBeCloseTo(width, 1);
        expect(bounds.width / mm).toBeCloseTo(width === 80 ? 72 : 48, 1);
        expect(bounds.left - paper.left).toBeCloseTo(paper.right - bounds.right, 1);
        expect(parseFloat(popup.getComputedStyle(slip).paddingTop) / mm).toBeLessThan(1);

        for (const selector of ['.slip-brand', '.slip-hospital', '.slip-title', '.slip-number', '.slip-footer', '.slip-thanks']) {
          const element = doc.querySelector<HTMLElement>(selector)!;
          const rect = element.getBoundingClientRect();
          expect(popup.getComputedStyle(element).textAlign).toBe('center');
          expect(rect.left + rect.width / 2).toBeCloseTo(paper.left + paper.width / 2, 1);
          expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
        }

        const values = Array.from(doc.querySelectorAll<HTMLElement>('.slip-value'));
        expect(values[0].textContent).toBe(name);
        values.forEach(value => {
          expect(popup.getComputedStyle(value).textAlign).toBe('right');
          expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1);
          expect(value.getBoundingClientRect().left).toBeCloseTo(values[0].getBoundingClientRect().left, 1);
          expect(value.getBoundingClientRect().right).toBeCloseTo(values[0].getBoundingClientRect().right, 1);
        });

        const thanks = doc.querySelector('.slip-thanks')!;
        expect(thanks.textContent).toBe('THANK YOU!');
        expect(bounds.bottom - thanks.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(10.9 * mm);
        const pageCss = doc.head.lastElementChild!.textContent!;
        const pageSize = pageCss.match(/size:(\d+)mm (\d+)mm/)!;
        expect(Number(pageSize[1])).toBe(width);
        expect(Number(pageSize[2]) * mm).toBeGreaterThan(bounds.bottom);
        expect(doc.querySelectorAll('.thermal-paper-feed').length).toBe(1);

        // Fitted token sizes must survive until print; close only after the
        // browser reports that the print job/dialog has finished.
        expect(popup.close).not.toHaveBeenCalled();
        popup.dispatchEvent(new Event('afterprint'));
        expect(popup.close).toHaveBeenCalled();
      });
    }
  }

  it('prints the complete 80 mm lab receipt with long tests and escaped patient text', async () => {
    const printed = new Promise<void>(resolve => spyOn(popup, 'print').and.callFake(resolve));
    const name = 'Ali <script>alert(1)</script> & Khan';
    const tests = 'CBC, Blood Group, Cross Match, Liver Function Tests, '.repeat(5);
    const html = buildLabReceipt({
      patientId: 42, name, testName: tests, phone: '', price: 1500,
      suggestedDr: 'Dr. ' + 'LongDoctorName'.repeat(8), dateTime: new Date('2026-11-17T07:35:00Z'),
    });
    printThermal(html, 80, 'lab-slip-print');
    await printed;

    const doc = popup.document;
    const slip = doc.getElementById('lab-slip-print')!;
    const values = Array.from(doc.querySelectorAll<HTMLElement>('.slip-value'));
    expect(values[1].textContent).toBe(name);
    expect(doc.querySelector('script')).toBeNull();
    expect(values.find(value => value.textContent === tests)).toBeDefined();
    values.forEach(value => expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1));
    const thanks = doc.querySelector('.slip-thanks')!;
    expect(thanks.textContent).toBe('THANK YOU!');
    expect(slip.getBoundingClientRect().bottom - thanks.getBoundingClientRect().bottom).toBeGreaterThan(10 * 96 / 25.4);
    expect(doc.head.lastElementChild!.textContent).toContain('size:80mm');
  });
});
