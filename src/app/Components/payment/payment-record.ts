import { ValidatorFn } from '@angular/forms';

export interface PaymentRecord {
  id: string;
  patientName: string;
  amount: number;
  patientId?: string;
  cashGiven?: number | null;
  cashReturn?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  staffName?: string;
  counterName?: string;
  shiftName?: string;
  shiftDate?: string;
  createdAt?: string;
  updatedAt?: string;
  recordedById?: string;
  recordedByEmail?: string;
  updatedById?: string;
  updatedByEmail?: string;
}

/** Validate cash in paise, avoiding floating point errors in change and totals. */
export function moneyCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  const cents = Math.round(number * 100);
  return Number.isFinite(number) && number >= 0 && Number.isSafeInteger(cents) && Math.abs(number * 100 - cents) < 0.00001 ? cents : null;
}

export const validMoney: ValidatorFn = control => control.value === '' || control.value === null || control.value === undefined
  ? null : moneyCents(control.value) === null ? { money: true } : null;

export function localPaymentDate(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const validShiftDate: ValidatorFn = control => {
  if (!control.value) return null;
  const value = String(control.value);
  const date = new Date(value + 'T12:00:00');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && localPaymentDate(date) === value ? null : { date: true };
};

export function paymentDate(payment: PaymentRecord): string {
  return payment.shiftDate || (payment.createdAt && !Number.isNaN(new Date(payment.createdAt).getTime()) ? localPaymentDate(new Date(payment.createdAt)) : '');
}

export function collectionTotals(payments: readonly PaymentRecord[]): { cash: number; card: number; collected: number; pending: number; completedCount: number } {
  let cash = 0, card = 0, collected = 0, pending = 0, completedCount = 0;
  for (const payment of payments) {
    const amount = moneyCents(payment.amount) ?? 0;
    if (payment.paymentStatus === 'pending') pending += amount;
    if (payment.paymentStatus !== 'completed') continue;
    completedCount++;
    collected += amount;
    if (payment.paymentMethod === 'cash') cash += amount;
    if (payment.paymentMethod === 'card') card += amount;
  }
  return { cash: cash / 100, card: card / 100, collected: collected / 100, pending: pending / 100, completedCount };
}
