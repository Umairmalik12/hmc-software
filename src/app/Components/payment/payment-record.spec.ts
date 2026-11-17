import { FormControl } from '@angular/forms';
import { collectionTotals, localPaymentDate, moneyCents, paymentDate, validShiftDate } from './payment-record';
import { buildPaymentReceipt } from './payment-receipt';

describe('Payment calculations and receipts', () => {
  it('validates finite amounts with two decimals and sums exact cents', () => {
    for (const value of [-1, NaN, Infinity, 'not money', true, '', null, 1.001]) expect(moneyCents(value)).toBeNull();
    expect(moneyCents(0.3)).toBe(30); expect(moneyCents('10.50')).toBe(1050);
    const totals = collectionTotals([
      { id: '1', patientName: 'A', amount: 0.1, paymentMethod: 'cash', paymentStatus: 'completed', cashGiven: 1, cashReturn: 0.9 },
      { id: '2', patientName: 'B', amount: 0.2, paymentMethod: 'card', paymentStatus: 'completed' },
      { id: '3', patientName: 'C', amount: 30, paymentMethod: 'cash', paymentStatus: 'failed' },
      { id: '4', patientName: 'D', amount: 20, paymentMethod: 'cash', paymentStatus: 'pending' },
      { id: '5', patientName: 'E', amount: 10, paymentStatus: 'completed' },
    ]);
    expect(totals).toEqual({ cash: 0.1, card: 0.2, collected: 10.3, pending: 20, completedCount: 3 });
  });
  it('uses the selected shift date for overnight reconciliation and checks real calendar dates', () => {
    expect(localPaymentDate(new Date(2026, 10, 17, 1, 30))).toBe('2026-11-17');
    expect(paymentDate({ id: '1', patientName: 'A', amount: 10, shiftDate: '2026-11-16', createdAt: new Date(2026, 10, 17, 1, 30).toISOString() })).toBe('2026-11-16');
    expect(validShiftDate(new FormControl('2026-02-30'))).toEqual({ date: true });
    expect(validShiftDate(new FormControl('2026-11-17'))).toBeNull();
  });
  it('escapes staff and patient text and accurately labels pending receipts', () => {
    const host = document.createElement('div');
    host.innerHTML = buildPaymentReceipt({ id: '1', patientName: 'Ali <script>alert(1)</script>', amount: 0.3, staffName: '<b>Ayesha</b>', shiftName: 'Night', shiftDate: '2026-11-16', paymentMethod: 'card', paymentStatus: 'pending' });
    expect(host.querySelector('script')).toBeNull(); expect(host.querySelector('b')).toBeNull();
    expect(host.textContent).toContain('<b>Ayesha</b>'); expect(host.textContent).toContain('PAYMENT PENDING');
    expect(host.textContent).not.toContain('PAYMENT COMPLETED'); expect(host.textContent).not.toContain('Tendered'); expect(host.textContent).toContain('THANK YOU!');
  });
});
