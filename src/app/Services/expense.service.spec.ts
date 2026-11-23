import { ExpenseDraft, expenseCents, expenseWeek, summarizeExpenses, validExpenseDate } from '../Models/expense.model';
import { ExpenseService, EXPENSE_COLLECTION } from './expense.service';
import { memoryDb } from '../testing/memory-db';
import { legacyRpcDb } from '../testing/legacy-rpc-db';

const draft = (overrides: Partial<ExpenseDraft> = {}): ExpenseDraft => ({ date: '2026-11-20', description: ' Generator fuel ', headId: 'fuel', amount: 25.15, remarks: '', location: 'Multan', ...overrides });
describe('Expense database operations and totals', () => {
  it('allows staff to create expenses but blocks edits, deletion and restoration before reading or writing saved records', async () => {
    const { db, collections } = memoryDb(); const service = new ExpenseService(db);
    (db.requireAdministrator as jasmine.Spy).and.rejectWith(new Error('Only administrators can edit, delete or restore expenses.'));
    const created = await service.save(draft()); expect(db.requireAdministrator).not.toHaveBeenCalled();
    const before = JSON.stringify(collections.get(EXPENSE_COLLECTION)!.get(created.id)); (db.getItem as jasmine.Spy).calls.reset();
    await expectAsync(service.save(draft({ amount: 999 }), created.id)).toBeRejectedWithError(/Only administrators/);
    await expectAsync(service.setDeleted(created.id, true)).toBeRejectedWithError(/Only administrators/);
    await expectAsync(service.setDeleted(created.id, false)).toBeRejectedWithError(/Only administrators/);
    expect(db.getItem).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled(); expect(JSON.stringify(collections.get(EXPENSE_COLLECTION)!.get(created.id))).toBe(before);
  });
  for (const [backend, create] of [['memory', memoryDb], ['legacy RPC', legacyRpcDb]] as const) {
    it('creates, updates, deletes and restores a single expense without changing other records via ' + backend, async () => {
      const { db, collections } = create(); const service = new ExpenseService(db);
      const setItem = jasmine.isSpy(db.setItem) ? db.setItem : spyOn(db, 'setItem').and.callThrough();
      const deleteRecord = jasmine.isSpy(db.deleteRecord) ? db.deleteRecord : spyOn(db, 'deleteRecord').and.callThrough();
      collections.set('payments', new Map([['1', { id: '1', amount: 500 }]]));
      const first = await service.save(draft()); const second = await service.save(draft({ description: 'Tea', headId: 'otRefreshments', amount: 0.1 }));
      expect(first.id).not.toBe(second.id); expect(first.description).toBe('Generator fuel'); expect(first.amount).toBe(25.15);
      const update = await service.save({ ...first, amount: 0.2 }, first.id);
      expect(update.createdAt).toBe(first.createdAt); expect(expenseCents(await service.getAll())).toBe(30);
      await service.setDeleted(first.id, true); expect((await service.getAll()).map(row => row.id)).toEqual([second.id]);
      expect((await service.getById(first.id))!.deletedAt).toBeTruthy(); expect(expenseCents(await service.getAll(true))).toBe(10);
      await expectAsync(service.save(draft(), first.id)).toBeRejectedWithError(/Restore/);
      await service.setDeleted(first.id, false); expect(expenseCents(await service.getAll())).toBe(30);
      expect(collections.get('payments')!.get('1')).toEqual({ id: '1', amount: 500 });
      expect(setItem).not.toHaveBeenCalled(); expect(deleteRecord).not.toHaveBeenCalled();
    });
  }
  it('rejects invalid dates, heads, amounts and missing edits before any writes', async () => {
    const { db } = memoryDb(); const service = new ExpenseService(db);
    for (const value of [{ date: '2026-02-29' }, { date: '2026-13-01' }, { date: 'nonsense' }, { description: '  ' }, { headId: 'unknown' }, { amount: -1 }, { amount: 0 }, { amount: 1.001 }, { amount: NaN }, { amount: Infinity }, { amount: null }, { location: 'X'.repeat(251) }]) await expectAsync(service.save(draft(value as any))).toBeRejected();
    await expectAsync(service.save(draft(), 'missing')).toBeRejectedWithError(/no longer exists/);
    await expectAsync(service.setDeleted('missing', true)).toBeRejectedWithError(/no longer exists/);
    expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
    expect(validExpenseDate('2028-02-29')).toBeTrue();
  });
  it('retains existing data and does not report success when a write fails', async () => {
    const { db, collections } = memoryDb(); const service = new ExpenseService(db); const row = await service.save(draft());
    (db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    await expectAsync(service.save(draft({ amount: 100 }), row.id)).toBeRejectedWithError('Offline');
    expect(collections.get(EXPENSE_COLLECTION)!.get(row.id).amount).toBe(25.15);
  });
  it('groups all expenses accurately by day, Monday week, month and head and excludes deleted rows', async () => {
    const { db } = memoryDb(); const service = new ExpenseService(db);
    await service.save(draft({ date: '2026-11-16', amount: 0.1 })); await service.save(draft({ date: '2026-11-22', amount: 0.2 }));
    const deleted = await service.save(draft({ amount: 500 })); await service.setDeleted(deleted.id, true);
    const rows = await service.getAll(true);
    expect(expenseWeek('2026-11-22')).toBe('2026-11-16'); expect(summarizeExpenses(rows, 'weekly')).toEqual([{ label: 'Week of 2026-11-16', count: 2, amount: 0.3 }]);
    expect(summarizeExpenses(rows, 'daily').length).toBe(2); expect(summarizeExpenses(rows, 'monthly')[0].amount).toBe(0.3); expect(summarizeExpenses(rows, 'heads')[0].label).toBe('FUEL EXP');
  });
});
