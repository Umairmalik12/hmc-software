import { escapeHtml } from 'src/app/Shared/escape-html';
import { PaymentRecord } from './payment-record';

export function buildPaymentReceipt(payment: PaymentRecord): string {
  const row = (label: string, value: unknown): string => `<div class="slip-row"><span class="slip-label">${escapeHtml(label)}</span><span class="slip-value">${escapeHtml(value ?? 'Not recorded')}</span></div>`;
  const money = (value: number | null | undefined): string => Number.isFinite(value) ? 'Rs ' + Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not recorded';
  return `<section id="payment-receipt"><div class="slip-brand">HAQ MEDICAL CENTER</div><div class="slip-title">PAYMENT RECEIPT</div><div class="slip-rule"></div>
    ${row('Receipt', '#' + payment.id)}${row('Patient', payment.patientName)}${payment.mrNumber ? row('MR Number', payment.mrNumber) : ''}${row('Patient ID', payment.patientId || 'Not recorded')}
    ${row('Date / time', payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-PK', { hour12: true }) : 'Not recorded')}
    <div class="slip-rule"></div>${row('Amount', money(payment.amount))}${row('Method', payment.paymentMethod || 'Not recorded')}${row('Status', payment.paymentStatus || 'Not recorded')}
    ${payment.paymentMethod === 'cash' ? row('Tendered', money(payment.cashGiven)) + row('Change', money(payment.cashReturn)) : ''}
    <div class="slip-rule"></div>${row('Counter staff', payment.staffName || 'Not recorded')}${row('Shift', payment.shiftName || 'Not recorded')}${row('Shift date', payment.shiftDate || 'Not recorded')}
    ${payment.counterName ? row('Counter', payment.counterName) : ''}<div class="slip-rule"></div><div class="slip-footer">${payment.paymentStatus === 'completed' ? 'PAYMENT COMPLETED' : 'PAYMENT ' + escapeHtml((payment.paymentStatus || 'NOT RECORDED').toUpperCase())}</div><div class="slip-thanks">THANK YOU!</div></section>`;
}
