import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { EXPENSE_GROUPS, EXPENSE_HEADS, EXPENSE_MONTHS, ExpenseRecord, ExpenseSummaryMode, expenseCents, expenseHead, localExpenseDate, summarizeExpenses } from '../../Models/expense.model';
import { EXPENSE_COLLECTION, ExpenseService } from '../../Services/expense.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { ScrollPagination, trackRecord } from '../../Shared/scroll-pagination';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { ExpenseEditComponent } from './expense-edit.component';
import { buildExpenseWorkbook, downloadExpenseWorkbook } from './expense-workbook';
import { ExpenseMonthPreviewComponent } from './expense-month-preview.component';

@Component({ selector: 'app-expenses', templateUrl: './expenses.component.html', styleUrls: ['./expenses.component.css'] })
export class ExpensesComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isSuperAdmin = false;
  readonly pagination = new ScrollPagination(); readonly trackRecord = trackRecord;
  readonly groups = EXPENSE_GROUPS; readonly months = EXPENSE_MONTHS; readonly head = expenseHead;
  records: ExpenseRecord[] = [];
  year = new Date().getFullYear(); month = new Date().getMonth() + 1;
  query = ''; group = ''; headFilter = ''; from = ''; to = ''; status = 'recorded'; summaryMode: ExpenseSummaryMode = 'monthly';
  loading = false; loadFailed = false; exporting = false; deletingId = ''; error = '';
  private changes?: Subscription; private version = 0; private destroyed = false;
  private editor?: MatDialogRef<ExpenseEditComponent>;
  constructor(private expenses: ExpenseService, private dialog: MatDialog, private feedback: NotifyUpdateService) {}
  ngOnInit(): void { void this.load(); this.changes = this.expenses.changes.subscribe(collection => { if (collection === EXPENSE_COLLECTION) void this.load(); }); }
  ngOnChanges(changes: SimpleChanges): void { if (changes.isSuperAdmin && !this.isSuperAdmin && this.editor?.componentInstance.data.record) this.editor.close(); }
  ngOnDestroy(): void { this.destroyed = true; this.version++; this.changes?.unsubscribe(); this.editor?.close(); }
  get years(): number[] { return [...new Set([new Date().getFullYear(), this.year, ...this.records.map(row => +row.date.slice(0, 4))])].sort((a, b) => b - a); }
  get headOptions(): string[] { return EXPENSE_HEADS.filter(head => !this.group || head.group === this.group).map(head => head.name); }
  get filtered(): ExpenseRecord[] {
    const query = this.query.trim().toLowerCase();
    return this.records.filter(row => +row.date.slice(0, 4) === this.year && (!this.month || +row.date.slice(5, 7) === this.month)
      && (this.status === 'all' || !!row.deleted === (this.status === 'deleted'))
      && (!this.group || expenseHead(row.headId)?.group === this.group) && (!this.headFilter || expenseHead(row.headId)?.name === this.headFilter)
      && (!this.from || row.date >= this.from) && (!this.to || row.date <= this.to)
      && (!query || [row.id, row.description, row.remarks, row.location, expenseHead(row.headId)?.name].join(' ').toLowerCase().includes(query)));
  }
  get visibleRecords(): ExpenseRecord[] { return this.pagination.slice(this.filtered); }
  get filteredTotal(): number { return expenseCents(this.filtered) / 100; }
  get recordedCount(): number { return this.filtered.filter(row => !row.deleted).length; }
  get yearTotal(): number { return expenseCents(this.records.filter(row => +row.date.slice(0, 4) === this.year)) / 100; }
  get summaries() { return summarizeExpenses(this.filtered, this.summaryMode); }
  onSearch(): void { this.pagination.reset(); }
  changeGroup(value: string): void { this.group = value; this.headFilter = ''; this.onSearch(); }
  clear(): void { this.query = ''; this.group = ''; this.headFilter = ''; this.month = 0; this.from = ''; this.to = ''; this.status = 'recorded'; this.onSearch(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true; this.loadFailed = false;
    try { const records = await this.expenses.getAll(true); if (version === this.version) { this.records = records; this.error = ''; } }
    catch (error) { if (version === this.version) { this.loadFailed = true; this.fail(error, 'Unable to load expenses.'); } }
    finally { if (version === this.version) this.loading = false; }
  }
  async edit(record?: ExpenseRecord): Promise<void> {
    if (this.loading || this.loadFailed || this.deletingId) return;
    try {
      await this.expenses.assertPermission(record ? 'edit' : 'create');
      const current = record ? await this.expenses.getById(record.id) : undefined;
      if (record && (!current || current.deleted)) throw new Error('This expense is unavailable. Refresh or restore it before editing.');
      if (this.destroyed) return;
      const ref = this.editor = this.dialog.open(ExpenseEditComponent, { data: { record: current }, disableClose: true, width: 'min(760px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      ref.afterClosed().subscribe((saved?: ExpenseRecord) => {
        if (this.editor === ref) this.editor = undefined;
        if (saved && !this.destroyed) { this.clear(); this.year = +saved.date.slice(0, 4); this.month = +saved.date.slice(5, 7); void this.load(); }
      });
    } catch (error) { this.fail(error, 'Unable to open the expense.'); }
  }
  view(record: ExpenseRecord): void {
    this.dialog.open(RecordDetailsComponent, { data: { title: 'Expense details', record: { expenseId: record.id, date: record.date,
      description: record.description, group: expenseHead(record.headId)?.group, expenseHead: expenseHead(record.headId)?.name,
      amount: record.amount, remarks: record.remarks, location: record.location, status: record.deleted ? 'Deleted' : 'Recorded', createdAt: record.createdAt, updatedAt: record.updatedAt } } });
  }
  async remove(record: ExpenseRecord): Promise<void> {
    if (this.deletingId || this.loading || this.loadFailed) return;
    try { await this.expenses.assertPermission(record.deleted ? 'edit' : 'delete'); }
    catch (error) { this.fail(error, 'You do not have permission to manage expenses.'); return; }
    if (!window.confirm((record.deleted ? 'Restore' : 'Delete') + ' expense #' + record.id + '? ' + (record.deleted ? 'It will be included in totals again.' : 'It will be excluded from totals and exports. You can restore it from Deleted expenses.'))) return;
    this.deletingId = record.id;
    try { await this.expenses.setDeleted(record.id, !record.deleted); this.feedback.success(record.deleted ? 'Expense restored successfully.' : 'Expense deleted successfully.', { route: '/expenses' }); await this.load(); }
    catch (error) { this.fail(error, 'Unable to update the expense.'); } finally { this.deletingId = ''; }
  }
  async export(): Promise<void> {
    if (this.exporting || this.loading || this.loadFailed) return;
    this.exporting = true;
    try {
      const records = await this.expenses.getAll(); if (this.destroyed) return;
      // Yield once so the busy indicator is painted before building the calendar worksheets.
      await new Promise(resolve => setTimeout(resolve, 30));
      const bytes = buildExpenseWorkbook(records, this.year, this.month || new Date().getMonth() + 1);
      downloadExpenseWorkbook(bytes, 'Haq-Medical-Center-Expenses-' + localExpenseDate() + '.xlsx');
      this.feedback.success('Expense workbook exported successfully.', { route: '/expenses' });
    } catch (error) { this.fail(error, 'Unable to export expenses.'); } finally { this.exporting = false; }
  }
  async printMonth(): Promise<void> {
    if (!this.month || this.loading || this.loadFailed) return;
    try {
      const rows = (await this.expenses.getAll()).filter(row => +row.date.slice(0, 4) === this.year && +row.date.slice(5, 7) === this.month);
      if (!this.destroyed) this.dialog.open(ExpenseMonthPreviewComponent, { data: { records: rows, year: this.year, month: this.month }, width: '1100px', maxWidth: '96vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    } catch (error) { this.fail(error, 'Unable to load the monthly expense sheet.'); }
  }
  private fail(error: unknown, fallback: string): void { this.error = error instanceof Error ? error.message : fallback; this.feedback.error(this.error); }
}
