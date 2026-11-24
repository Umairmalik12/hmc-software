import { Injectable } from '@angular/core';
import { ExpenseDraft, ExpenseRecord, expenseHead, validExpenseDate } from '../Models/expense.model';
import { moneyCents } from '../Components/payment/payment-record';
import { SupabaseDataService } from './supabase-data.service';

export const EXPENSE_COLLECTION = 'expenseDetails';
@Injectable({ providedIn: 'root' })
export class ExpenseService {
  readonly changes = this.db.changes;
  constructor(private db: SupabaseDataService) {}
  assertPermission(action: 'create' | 'edit' | 'delete'): Promise<void> { return this.db.requirePermission('expenses', action); }
  async getAll(includeDeleted = false): Promise<ExpenseRecord[]> {
    const rows = await this.db.getItem<ExpenseRecord[]>(EXPENSE_COLLECTION) || [];
    return rows.filter(row => includeDeleted || !row.deleted).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }
  async getById(id: string): Promise<ExpenseRecord | undefined> { return (await this.getAll(true)).find(row => row.id === id); }
  async save(draft: ExpenseDraft, id?: string): Promise<ExpenseRecord> {
    await this.db.requirePermission('expenses', id ? 'edit' : 'create', id ? 'You do not have permission to edit expenses.' : 'You do not have permission to create expenses.');
    if (!validExpenseDate(draft.date)) throw new Error('Enter a valid expense date.');
    if (!expenseHead(draft.headId)) throw new Error('Select an expense head.');
    const cents = moneyCents(draft.amount); if (cents === null || cents <= 0) throw new Error('Enter an amount greater than zero with up to two decimals.');
    const text = (value: unknown, label: string, max: number): string => {
      if (value != null && typeof value !== 'string') throw new Error('Enter a valid ' + label + '.');
      const result = String(value ?? '').trim(); if (result.length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.'); return result;
    };
    const description = text(draft.description, 'purpose', 1000); if (!description) throw new Error('Enter the expense purpose.');
    const remarks = text(draft.remarks, 'remarks', 1000), location = text(draft.location, 'location', 250);
    const previous = id ? await this.getById(id) : undefined;
    if (id && !previous) throw new Error('This expense no longer exists. Refresh the list.');
    if (previous?.deleted) throw new Error('Restore this expense before editing it.');
    const now = new Date().toISOString();
    const record: ExpenseRecord = { ...previous, id: previous?.id || String(await this.db.allocateId(EXPENSE_COLLECTION)), date: draft.date, description,
      headId: draft.headId, amount: cents / 100, remarks, location, deleted: false, createdAt: previous?.createdAt || now, updatedAt: now };
    if (previous) await this.db.upsertRecord(EXPENSE_COLLECTION, record.id, record); else await this.db.insertRecord(EXPENSE_COLLECTION, record.id, record);
    this.db.changes.next(EXPENSE_COLLECTION); return record;
  }
  async setDeleted(id: string, deleted: boolean): Promise<void> {
    await this.db.requirePermission('expenses', deleted ? 'delete' : 'edit', deleted ? 'You do not have permission to delete expenses.' : 'You do not have permission to restore expenses.');
    const current = await this.getById(id); if (!current) throw new Error('This expense no longer exists. Refresh the list.');
    const now = new Date().toISOString(); const record = { ...current, deleted, deletedAt: deleted ? now : '', updatedAt: now };
    await this.db.upsertRecord(EXPENSE_COLLECTION, id, record); this.db.changes.next(EXPENSE_COLLECTION);
  }
}
