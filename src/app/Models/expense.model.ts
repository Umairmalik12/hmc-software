import { moneyCents } from '../Components/payment/payment-record';

export interface ExpenseHead { id: string; name: string; group: string; description: string; }
export const EXPENSE_HEADS: ExpenseHead[] = [
  { id: 'overhead', name: 'OVERHEAD', group: 'GENERAL', description: 'General running costs not covered by another head.' },
  { id: 'home', name: 'HOME EXP', group: 'GENERAL', description: 'Household or personal-side expenses paid by the centre.' },
  { id: 'donation', name: 'DONATION', group: 'GENERAL', description: 'Charity and donations.' },
  { id: 'otRefreshments', name: 'OT REFRESHMENT', group: 'FOOD & REFRESHMENT', description: 'Food and drinks for the OT team.' },
  { id: 'staffRefreshments', name: 'STAFF EATING / REFRESHMENTS', group: 'FOOD & REFRESHMENT', description: 'Staff meals, night meals and refreshments.' },
  { id: 'equipment', name: 'HOSPITAL EQUIPMENT', group: 'MEDICAL', description: 'Medical equipment, supplies and related items.' },
  { id: 'laundry', name: 'HOSPITAL LAUNDRY', group: 'MEDICAL', description: 'Hospital linen and uniform laundry.' },
  { id: 'cylinder', name: 'CYLINDER', group: 'MEDICAL', description: 'Cylinders for hospital equipment and power.' },
  { id: 'building', name: 'BUILDING REPAIR', group: 'BUILDING & CLEANING', description: 'Building repairs and maintenance.' },
  { id: 'cleaning', name: 'CLEANING', group: 'BUILDING & CLEANING', description: 'Cleaning and hygiene supplies.' },
  { id: 'fuel', name: 'FUEL EXP', group: 'VEHICLE', description: 'Petrol and diesel.' },
  { id: 'vehicle', name: 'VEHICLE EXPENSE', group: 'VEHICLE', description: 'Vehicle repair, service, tyres, parking and related expenses.' },
  { id: 'internet', name: 'INTERNET & CABLE', group: 'OFFICE & UTILITIES', description: 'Internet, cable and phone-line bills.' },
  { id: 'stationery', name: 'STATIONARY', group: 'OFFICE & UTILITIES', description: 'Office stationery and printing supplies.' },
];
export const EXPENSE_GROUPS = [...new Set(EXPENSE_HEADS.map(head => head.group))];
export const EXPENSE_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export interface ExpenseDraft { date: string; description: string; headId: string; amount: number; remarks: string; location: string; }
export interface ExpenseRecord extends ExpenseDraft { id: string; deleted: boolean; deletedAt?: string; createdAt: string; updatedAt: string; }
export const expenseHead = (id: string): ExpenseHead | undefined => EXPENSE_HEADS.find(head => head.id === id);
export function localExpenseDate(date = new Date()): string { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
export function validExpenseDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const expenseCents = (rows: readonly ExpenseRecord[]): number => rows.filter(row => !row.deleted).reduce((total, row) => total + (moneyCents(row.amount) || 0), 0);
export function expenseWeek(date: string): string {
  const value = new Date(date + 'T00:00:00Z'); value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7); return value.toISOString().slice(0, 10);
}
export type ExpenseSummaryMode = 'daily' | 'weekly' | 'monthly' | 'heads';
export interface ExpenseSummary { label: string; count: number; amount: number; }
export function summarizeExpenses(rows: readonly ExpenseRecord[], mode: ExpenseSummaryMode): ExpenseSummary[] {
  const totals = new Map<string, { cents: number; count: number }>();
  for (const row of rows.filter(item => !item.deleted)) {
    const key = mode === 'heads' ? expenseHead(row.headId)?.name || row.headId : mode === 'monthly' ? row.date.slice(0, 7) : mode === 'weekly' ? expenseWeek(row.date) : row.date;
    const total = totals.get(key) || { cents: 0, count: 0 }; total.cents += moneyCents(row.amount) || 0; total.count++; totals.set(key, total);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label: mode === 'weekly' ? 'Week of ' + label : label, count: total.count, amount: total.cents / 100 }));
}
