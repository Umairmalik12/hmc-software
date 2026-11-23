import { DateTimeFieldComponent } from '../../Shared/date-time-field.component';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ExpenseEditComponent } from './expense-edit.component';
import { ExpensesComponent } from './expenses.component';
import { ExpenseMonthPreviewComponent } from './expense-month-preview.component';
import { ExpenseRecord } from '../../Models/expense.model';
import { ExpenseService, EXPENSE_COLLECTION } from '../../Services/expense.service';
import { SupabaseDataService } from '../../Services/supabase-data.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { SearchableSelectComponent } from '../../Shared/searchable-select.component';
import { FeedbackModule } from '../../Shared/feedback.module';
import { ScrollPaginationDirective } from '../../Shared/scroll-pagination.directive';
import { ScrollListFooterComponent } from '../../Shared/scroll-list-footer.component';
import { RecordDetailsComponent } from '../record-details/record-details.component';
import { memoryDb } from '../../testing/memory-db';

const row = (i: number): ExpenseRecord => ({ id: String(i), date: '2026-11-20', description: 'Expense ' + i, headId: 'fuel', amount: 10.25, remarks: '', location: '', deleted: false, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' });
describe('Expense management interface', () => {
  let service: ExpenseService, db: SupabaseDataService, collections: Map<string, Map<string, any>>, close: jasmine.Spy, data: any;
  const settle = async (fixture?: ComponentFixture<unknown>) => { fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 40)); fixture?.detectChanges(); TestBed.inject(ApplicationRef).tick(); };
  beforeEach(async () => {
    const memory = memoryDb(); db = memory.db; collections = memory.collections; close = jasmine.createSpy('close'); data = {};
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent, SearchableSelectComponent, CommonModule, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, FeedbackModule],
      declarations: [ExpensesComponent, ExpenseEditComponent, ExpenseMonthPreviewComponent, ScrollPaginationDirective, ScrollListFooterComponent, RecordDetailsComponent],
      providers: [{ provide: SupabaseDataService, useValue: db }, { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }],
    }).compileComponents(); service = TestBed.inject(ExpenseService);
  });
  afterEach(() => TestBed.inject(MatDialog).closeAll());
  it('validates required business fields and saves an expense with optional remarks and location empty', async () => {
    const fixture = TestBed.createComponent(ExpenseEditComponent);
    try {
      await settle(fixture); const editor = fixture.componentInstance; await editor.save(); expect(close).not.toHaveBeenCalled();
      editor.form.patchValue({ date: '2026-11-20', description: 'Tea', amount: 55.5 }); editor.selectHead('OT REFRESHMENT'); await editor.save();
      expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ description: 'Tea', amount: 55.5, headId: 'otRefreshments', remarks: '', location: '' }));
      expect((await service.getAll()).length).toBe(1);
    } finally { fixture.destroy(); }
  });
  it('loads the existing expense for editing and keeps the draft available after failed saves', async () => {
    const existing = await service.save(row(1)); data.record = existing;
    const fixture = TestBed.createComponent(ExpenseEditComponent);
    try {
      await settle(fixture); const editor = fixture.componentInstance; expect(editor.headName).toBe('FUEL EXP'); editor.form.patchValue({ description: 'Updated fuel', amount: 20.5 });
      const save = spyOn(service, 'save').and.rejectWith(new Error('Offline')); await editor.save(); await settle(fixture);
      expect(close).not.toHaveBeenCalled(); expect(editor.form.enabled).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('Offline');
      save.and.callThrough(); await editor.save(); expect(close).toHaveBeenCalledWith(jasmine.objectContaining({ id: existing.id, description: 'Updated fuel', amount: 20.5 }));
    } finally { fixture.destroy(); }
  });
  it('filters before pagination, searches all records and calculates totals without deleted expenses', async () => {
    const rows = Array.from({ length: 65 }, (_, i) => row(i + 1)); rows[0].deleted = true; rows[1].headId = 'overhead'; rows[2].date = '2026-10-01';
    collections.set(EXPENSE_COLLECTION, new Map(rows.map(record => [record.id, record])));
    const fixture = TestBed.createComponent(ExpensesComponent);
    try {
      await settle(fixture); const list = fixture.componentInstance; list.year = 2026; list.month = 11; expect(list.filtered.length).toBe(63); expect(list.visibleRecords.length).toBe(20);
      list.loadMore(); expect(list.visibleRecords.length).toBe(40); list.loadMore(); list.loadMore(); expect(list.visibleRecords.length).toBe(63);
      list.query = 'Expense 65'; list.onSearch(); expect(list.filtered.map(record => record.id)).toEqual(['65']); expect(list.pagination.limit).toBe(20);
      list.query = ''; list.changeGroup('GENERAL'); expect(list.filtered.map(record => record.id)).toEqual(['2']);
      list.clear(); expect(list.filteredTotal).toBe(656); expect(list.yearTotal).toBe(656); expect(list.summaries.reduce((total, item) => total + item.count, 0)).toBe(64);
      list.status = 'deleted'; expect(list.filtered.length).toBe(1); expect(list.filteredTotal).toBe(0);
    } finally { fixture.destroy(); }
  });
  it('previews, edits and confirms deleting/restoring expenses with notifications and fresh print data', async () => {
    const existing = await service.save(row(1)); const fixture = TestBed.createComponent(ExpensesComponent);
    try {
      fixture.componentRef.setInput('isSuperAdmin', true);
      await settle(fixture); const list = fixture.componentInstance; list.year = 2026; list.month = 11;
      list.view(existing); await settle(fixture); expect(document.body.textContent).toContain('Expense details'); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
      await list.edit(existing); await settle(fixture); const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ExpenseEditComponent; expect(editor.form.get('amount')!.value).toBe(10.25); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
      const confirm = spyOn(window, 'confirm').and.returnValue(false); await list.remove(existing); expect((await service.getAll()).length).toBe(1);
      confirm.and.returnValue(true); await list.remove(existing); expect((await service.getAll()).length).toBe(0);
      list.status = 'deleted'; const removed = list.filtered[0]; expect(removed.id).toBe(existing.id); await list.remove(removed); expect((await service.getAll()).length).toBe(1);
      await service.save({ ...existing, amount: 50 }, existing.id); await settle(fixture); await list.printMonth(); await settle(fixture);
      const preview = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ExpenseMonthPreviewComponent; expect(preview.html).toContain('50.00');
      let notifications: readonly any[] = []; const sub = TestBed.inject(NotifyUpdateService).notifications$.subscribe(items => notifications = items);
      expect(notifications.some(item => item.description === 'Expense deleted successfully.')).toBeTrue(); sub.unsubscribe();
    } finally { fixture.destroy(); }
  });
  it('lets staff view, add, filter and preview expenses while hiding and blocking edit/delete/restore', async () => {
    const existing = await service.save(row(1)); const removed = await service.save(row(2)); await service.setDeleted(removed.id, true);
    const fixture = TestBed.createComponent(ExpensesComponent);
    try {
      await settle(fixture); const list = fixture.componentInstance; list.year = 2026; list.month = 11; await settle(fixture); const root: HTMLElement = fixture.nativeElement;
      expect(list.isSuperAdmin).toBeFalse(); expect(root.querySelector('[aria-label="Preview expense"]')).not.toBeNull(); expect(root.querySelector('[aria-label="Edit expense"]')).toBeNull(); expect(root.querySelector('[aria-label="Delete expense"]')).toBeNull();
      list.status = 'deleted'; await settle(fixture); expect(root.querySelector('[aria-label="Restore expense"]')).toBeNull();
      const confirm = spyOn(window, 'confirm'); const setDeleted = spyOn(service, 'setDeleted').and.callThrough(); await list.edit(existing); await list.remove(existing); await list.remove({ ...removed, deleted: true });
      expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0); expect(confirm).not.toHaveBeenCalled(); expect(setDeleted).not.toHaveBeenCalled();
      await list.edit(); await settle(fixture); const editor = TestBed.inject(MatDialog).openDialogs[0].componentInstance as ExpenseEditComponent;
      editor.form.patchValue({ date: '2026-11-20', description: 'Staff expense', headId: 'fuel', amount: 30 }); await editor.save(); await settle(fixture);
      expect((await service.getAll()).some(record => record.description === 'Staff expense')).toBeTrue(); expect(list.status).toBe('recorded');
      list.view(existing); await settle(fixture); expect(document.body.textContent).toContain('Expense details'); TestBed.inject(MatDialog).closeAll(); await settle(fixture);
      list.query = 'Staff expense'; list.onSearch(); expect(list.filtered.length).toBe(1); await list.printMonth(); await settle(fixture); expect(TestBed.inject(MatDialog).openDialogs[0].componentInstance).toEqual(jasmine.any(ExpenseMonthPreviewComponent));
    } finally { fixture.destroy(); }
  });
  it('closes an existing-expense editor if admin access is removed, while leaving new expense creation available', async () => {
    const existing = await service.save(row(1)); const fixture = TestBed.createComponent(ExpensesComponent);
    try {
      fixture.componentRef.setInput('isSuperAdmin', true); await settle(fixture); await fixture.componentInstance.edit(existing); await settle(fixture); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
      fixture.componentRef.setInput('isSuperAdmin', false); await settle(fixture); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
      await fixture.componentInstance.edit(); await settle(fixture); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    } finally { fixture.destroy(); }
  });
  it('keeps the editor inside the viewport and save actions reachable', async () => {
    const ref = TestBed.inject(MatDialog).open(ExpenseEditComponent, { data: {}, width: 'min(760px, calc(100vw - 32px))', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' }); await settle();
    const panel = document.querySelector('.hmc-dialog-panel')!.getBoundingClientRect();
    expect(panel.left).toBeGreaterThanOrEqual(0); expect(panel.right).toBeLessThanOrEqual(window.innerWidth + 1);
    const actions = document.querySelector('.hmc-dialog-panel mat-dialog-actions')!.getBoundingClientRect(); expect(actions.bottom).toBeLessThanOrEqual(window.innerHeight); expect(actions.height).toBeGreaterThan(0); ref.close();
  });
  it('aligns filter fields and currency headings while keeping table overflow inside the list', async () => {
    collections.set(EXPENSE_COLLECTION, new Map([['1', { ...row(1), description: 'LongPurposeWithoutSpaces'.repeat(20), amount: 123456789.25 }]]));
    const fixture = TestBed.createComponent(ExpensesComponent);
    try {
      await settle(fixture); fixture.componentInstance.year = 2026; fixture.componentInstance.month = 11; await settle(fixture);
      const root = fixture.nativeElement as HTMLElement;
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      const wrappers = root.querySelectorAll<HTMLElement>('.expense-filters > mat-form-field .mat-mdc-text-field-wrapper');
      expect(Math.abs(wrappers[1].getBoundingClientRect().top - wrappers[2].getBoundingClientRect().top)).toBeLessThan(2);
      expect(getComputedStyle(root.querySelector('.records-table th.amount')!).textAlign).toBe('right');
      expect(getComputedStyle(root.querySelector('.records-table td.amount')!).textAlign).toBe('right');
      const scroll = root.querySelector<HTMLElement>('.table-scroll-container')!;
      const actions = root.querySelector<HTMLElement>('.records-table tbody td:last-child')!.getBoundingClientRect();
      expect(actions.right).toBeLessThanOrEqual(scroll.getBoundingClientRect().right + 1);
      expect(root.querySelector('.summary-table tfoot')!.textContent).toContain('123,456,789.25');
    } finally { fixture.destroy(); }
  });
  it('fits the complete monthly paper to the dialog, supports readable zoom and keeps print controls visible', async () => {
    const rows = Array.from({ length: 65 }, (_, i) => ({ ...row(i + 1), description: 'A long expense purpose '.repeat(12), remarks: 'Detailed remarks '.repeat(8), amount: 100000.25 }));
    const ref = TestBed.inject(MatDialog).open(ExpenseMonthPreviewComponent, { data: { records: rows, year: 2026, month: 11 }, width: '1100px', maxWidth: '96vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    await settle(); await new Promise(resolve => setTimeout(resolve, 80)); await settle();
    const preview = ref.componentInstance;
    const panel = document.querySelector<HTMLElement>('.hmc-dialog-panel')!;
    const viewport = panel.querySelector<HTMLElement>('.preview-viewport')!;
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
    expect(preview.scale).toBeLessThan(1); expect(preview.scale).toBeGreaterThan(0);
    expect(panel.querySelectorAll('.expense-print tbody tr').length).toBe(1);
    expect(panel.querySelectorAll('.expense-print td[data-head-id="fuel"] .expense-cell-entry').length).toBe(65);
    expect(panel.querySelector('.expense-print tfoot')!.textContent).toContain('6,500,016.25');
    const actions = panel.querySelector('mat-dialog-actions')!.getBoundingClientRect();
    expect(actions.bottom).toBeLessThanOrEqual(window.innerHeight); expect(actions.height).toBeGreaterThan(0);
    const paper = panel.querySelector<HTMLElement>('.expense-sheet-preview')!;
    const headerBefore = document.body.style.fontFamily;
    preview.actualSize(); await settle(); expect(preview.scale).toBe(1); expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
    preview.zoom(1); await settle(); expect(preview.scale).toBe(1.1);
    preview.fit(); await settle(); expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
    expect(paper.querySelector('script')).toBeNull(); expect(document.body.style.fontFamily).toBe(headerBefore);
    ref.close();
  });
  it('prints the exact grouped document shown in the preview', async () => {
    const ref = TestBed.inject(MatDialog).open(ExpenseMonthPreviewComponent, { data: { records: [row(1), row(2)], year: 2026, month: 11 }, panelClass: 'hmc-dialog-panel' });
    await settle();
    const write = jasmine.createSpy('write'), print = jasmine.createSpy('print');
    const popup = { closed: false, document: { open: jasmine.createSpy(), write, close: jasmine.createSpy(), fonts: { ready: Promise.resolve() } }, focus: jasmine.createSpy(), print, close: jasmine.createSpy() } as unknown as Window;
    spyOn(window, 'open').and.returnValue(popup); ref.componentInstance.print(); await settle();
    expect(write).toHaveBeenCalledWith(jasmine.stringContaining(ref.componentInstance.html)); expect(print).toHaveBeenCalledTimes(1);
    expect(ref.componentInstance.count).toBe(2); expect(ref.componentInstance.total).toBe(20.5); ref.close();
  });
  it('shows loading failures with retry and prevents adding or exporting an incomplete list', async () => {
    const load = spyOn(service, 'getAll').and.rejectWith(new Error('Offline')); const fixture = TestBed.createComponent(ExpensesComponent);
    try { await settle(fixture); expect(fixture.componentInstance.loadFailed).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('Offline'); await fixture.componentInstance.edit(); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0); load.and.callThrough(); await fixture.componentInstance.load(); expect(fixture.componentInstance.loadFailed).toBeFalse(); } finally { fixture.destroy(); }
  });
});
