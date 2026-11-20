import { AfterViewInit, Component, ElementRef, Inject, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EXPENSE_MONTHS, expenseCents } from '../../Models/expense.model';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { ExpenseMonthData, expenseMonthHtml, monthExpenses } from './expense-month-document';
export { ExpenseMonthData, expenseMonthHtml } from './expense-month-document';

@Component({ selector: 'app-expense-month-preview', templateUrl: './expense-month-preview.component.html', styleUrls: ['./expense-month-preview.component.css'] })
export class ExpenseMonthPreviewComponent implements AfterViewInit, OnDestroy {
  readonly html: string; readonly safeHtml: SafeHtml;
  readonly paperWidth = 1122;
  readonly period: string;
  readonly count: number;
  readonly total: number;
  fitToWidth = true;
  scale = 1;
  paperHeight = 794;
  @ViewChild('viewport') viewport?: ElementRef<HTMLElement>;
  @ViewChild('paper') paper?: ElementRef<HTMLElement>;
  private observer?: ResizeObserver;
  private frame = 0;
  private destroyed = false;
  constructor(@Inject(MAT_DIALOG_DATA) public data: ExpenseMonthData, sanitizer: DomSanitizer, private feedback: NotifyUpdateService, private zone: NgZone) {
    this.html = expenseMonthHtml(data); this.safeHtml = sanitizer.bypassSecurityTrustHtml(this.html);
    const rows = monthExpenses(data); this.count = rows.length; this.total = expenseCents(rows) / 100;
    this.period = EXPENSE_MONTHS[data.month - 1] + ' ' + data.year;
  }
  get zoomPercent(): number { return Math.round(this.scale * 100); }
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new ResizeObserver(() => this.scheduleLayout());
      this.observer.observe(this.viewport!.nativeElement); this.observer.observe(this.paper!.nativeElement);
      this.scheduleLayout(); void document.fonts.ready.then(() => this.scheduleLayout());
    });
  }
  ngOnDestroy(): void { this.destroyed = true; this.observer?.disconnect(); cancelAnimationFrame(this.frame); }
  fit(): void { this.fitToWidth = true; this.scheduleLayout(); }
  actualSize(): void { this.fitToWidth = false; this.scale = 1; this.scheduleLayout(); }
  zoom(direction: number): void { this.fitToWidth = false; this.scale = Math.max(0.15, Math.min(1.5, Math.round((this.scale + direction * 0.1) * 100) / 100)); this.scheduleLayout(); }
  private scheduleLayout(): void {
    if (this.destroyed) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      if (this.destroyed || !this.viewport || !this.paper) return;
      const scale = this.fitToWidth ? Math.max(0.1, Math.min(1, (this.viewport.nativeElement.clientWidth - 32) / this.paperWidth)) : this.scale;
      const height = this.paper.nativeElement.offsetHeight;
      if (Math.abs(this.scale - scale) > 0.0001 || this.paperHeight !== height) this.zone.run(() => { this.scale = scale; this.paperHeight = height; });
    });
  }
  print(): void {
    const popup = window.open('', '_blank', 'width=1200,height=800');
    if (!popup) { this.feedback.error('Allow pop-ups to print the expense sheet.'); return; }
    popup.document.open(); popup.document.write('<!doctype html><html><head><meta charset="UTF-8"><title>Monthly expenses</title><style>body{margin:0;background:#fff}</style></head><body>' + this.html + '</body></html>'); popup.document.close();
    popup.onafterprint = () => popup.close();
    void popup.document.fonts.ready.then(() => { if (!popup.closed) { popup.focus(); popup.print(); this.feedback.info('Expense sheet sent to the print dialog.', { route: '/expenses' }); } });
  }
}
