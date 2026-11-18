import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { StaffIdentity, UserLoginService } from 'src/app/Services/user-login.service';
import { requiredText } from 'src/app/Services/validators.service';
import { exportRecords } from 'src/app/Shared/export-records';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { printThermal } from '../patient-token/thermal-print';
import { collectionTotals, localPaymentDate, moneyCents, PaymentRecord, paymentDate, validMoney, validShiftDate } from './payment-record';
import { buildPaymentReceipt } from './payment-receipt';

@Component({ selector: 'app-payment', templateUrl: './payment.component.html', styleUrls: ['./payment.component.css'] })
export class PaymentComponent implements OnInit, OnDestroy {
  paymentForm!: FormGroup;
  payments: PaymentRecord[] = [];
  displayedPayments: PaymentRecord[] = [];
  displayedColumns = ['patientName', 'createdAt', 'staff', 'amount', 'cash', 'paymentMethod', 'paymentStatus', 'actions'];
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly shiftSuggestions = ['Morning', 'Evening', 'Night'];
  cashReturn = 0;
  patientId = '';
  saving = false;
  loading = false;
  accountLoading = true;
  errorMessage = '';
  successMessage = '';
  editingId = '';
  deletingId = '';
  paymentSearch = '';
  staffFilter = '';
  shiftFilter = '';
  statusFilter = '';
  methodFilter = '';
  fromDate = '';
  toDate = '';
  isSuperAdmin = false;
  printAfterSave = true;
  paperWidth: 58 | 80 = 58;
  currentTime = new Date();
  identity?: StaffIdentity;
  private context = { staffName: '', shiftName: '', counterName: '' };
  private counterDate = localPaymentDate();
  private pendingCreateId = '';
  private loadVersion = 0;
  private destroyed = false;
  private subscriptions = new Subscription();
  private clock?: ReturnType<typeof setInterval>;

  constructor(private fb: FormBuilder, private indexedDbService: SupabaseDataService, private user: UserLoginService, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}

  async ngOnInit(): Promise<void> {
    this.paymentForm = this.fb.group({
      patientName: ['', [requiredText, Validators.maxLength(120)]],
      patientId: [{ value: this.generatePatientId(), disabled: true }],
      amount: [null, [Validators.required, validMoney]],
      cashGiven: [null, validMoney],
      paymentMethod: ['cash', [Validators.required, Validators.pattern(/^(cash|card)$/)]],
      paymentStatus: ['completed', [Validators.required, Validators.pattern(/^(completed|pending|failed)$/)]],
      staffName: ['', [requiredText, Validators.maxLength(120)]],
      shiftName: ['', [requiredText, Validators.maxLength(60)]],
      shiftDate: [localPaymentDate(), [Validators.required, validShiftDate]],
      counterName: ['', Validators.maxLength(60)],
    });
    this.subscriptions.add(this.paymentForm.valueChanges.subscribe(() => this.calculateCashReturn()));
    this.subscriptions.add(this.paymentForm.get('paymentMethod')!.valueChanges.subscribe(method => {
      this.paymentForm.get('cashGiven')!.setValidators(method === 'cash' ? [validMoney] : []);
      this.paymentForm.get('cashGiven')!.updateValueAndValidity({ emitEvent: false });
    }));
    this.subscriptions.add(this.indexedDbService.changes.subscribe(collection => {
      if (collection === 'payments') void this.loadPayments().catch(error => { this.errorMessage = this.message(error, 'Unable to refresh payments.'); this.feedback.error(this.errorMessage); });
    }));
    this.clock = setInterval(() => this.currentTime = new Date(), 1000);
    await Promise.all([this.loadAccount(), this.loadPayments().catch(error => { this.errorMessage = this.message(error, 'Unable to load payments.'); this.feedback.error(this.errorMessage); })]);
  }

  private async loadAccount(): Promise<void> {
    try {
      const [identity, role] = await Promise.all([this.user.getStaffIdentity(), this.user.getLoginUser()]);
      if (this.destroyed) return;
      this.identity = identity;
      this.isSuperAdmin = role === 'admin';
      this.context.staffName = identity.name;
      try {
        const context = JSON.parse(localStorage.getItem('hmc.paymentCounter.' + identity.id) || '{}');
        for (const key of ['staffName', 'shiftName', 'counterName'] as const) {
          if (typeof context[key] === 'string') this.context[key] = context[key].slice(0, key === 'staffName' ? 120 : 60);
        }
        this.paperWidth = localStorage.getItem('hmc.paymentPaperWidth') === '80' ? 80 : 58;
      } catch { /* Counter defaults are optional on devices with restricted storage. */ }
      if (!this.editingId) this.paymentForm.patchValue(this.context);
    } catch (error) { this.errorMessage = this.message(error, 'Unable to load your staff account. Refresh before recording a payment.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.accountLoading = false; }
  }

  async retryAccount(): Promise<void> { this.accountLoading = true; await this.loadAccount(); }

  ngOnDestroy(): void { this.destroyed = true; this.loadVersion++; this.subscriptions.unsubscribe(); if (this.clock) clearInterval(this.clock); }
  private message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
  generatePatientId(): string { return this.patientId = 'P-' + Math.random().toString(36).slice(2, 11); }
  loadMore(): void { this.pagination.loadMore(this.filteredPayments.length); this.applyPaymentFilter(false); }

  async loadPayments(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    try {
      const records = await this.indexedDbService.getItem<PaymentRecord[]>('payments');
      if (version !== this.loadVersion || this.destroyed) return;
      this.payments = [...(records || [])].sort((a, b) => {
        const time = (value?: string): number => value ? new Date(value).getTime() || 0 : 0;
        return time(b.createdAt) - time(a.createdAt) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
      });
      this.applyPaymentFilter(false);
    } finally { if (version === this.loadVersion) this.loading = false; }
  }

  calculateCashReturn(): void {
    const raw = this.paymentForm.getRawValue();
    const amount = moneyCents(raw.amount) ?? 0;
    const tendered = moneyCents(raw.cashGiven) ?? amount;
    this.cashReturn = raw.paymentMethod === 'cash' ? Math.max(0, tendered - amount) / 100 : 0;
  }

  private attributionValidators(editing: boolean): void {
    for (const [field, max] of [['staffName', 120], ['shiftName', 60]] as const) {
      this.paymentForm.get(field)!.setValidators(editing ? [Validators.maxLength(max)] : [requiredText, Validators.maxLength(max)]);
      this.paymentForm.get(field)!.updateValueAndValidity({ emitEvent: false });
    }
    this.paymentForm.get('shiftDate')!.setValidators(editing ? [validShiftDate] : [Validators.required, validShiftDate]);
    this.paymentForm.get('shiftDate')!.updateValueAndValidity({ emitEvent: false });
  }

  private validateCompletedCash(record: PaymentRecord): void {
    if (record.paymentStatus === 'completed' && record.paymentMethod === 'cash' && (moneyCents(record.cashGiven) ?? 0) < (moneyCents(record.amount) ?? 0)) {
      throw new Error('Cash tendered is less than the amount. Enter the full cash received or keep this payment pending.');
    }
  }

  async processPayment(): Promise<void> {
    if (this.saving || this.deletingId || this.accountLoading) return;
    this.errorMessage = ''; this.successMessage = '';
    if (!this.identity) { this.errorMessage = 'Refresh your staff account before recording a payment.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); return; }
    if (this.paymentForm.invalid) { this.paymentForm.markAllAsTouched(); this.errorMessage = 'Complete the highlighted fields before saving.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); return; }
    this.saving = true;
    const wasEditing = !!this.editingId;
    try {
      const existing = wasEditing ? (await this.indexedDbService.getItem<PaymentRecord[]>('payments') || []).find(item => item.id === this.editingId) : undefined;
      if (wasEditing && !existing) throw new Error('This payment no longer exists. Refresh the payment list.');
      const raw = this.paymentForm.getRawValue();
      const now = new Date().toISOString();
      const amount = moneyCents(raw.amount)! / 100;
      const cashGiven = raw.paymentMethod === 'cash' ? (moneyCents(raw.cashGiven) ?? (raw.paymentStatus === 'completed' ? moneyCents(raw.amount)! : 0)) / 100 : 0;
      const payment: PaymentRecord = { ...existing, ...raw, id: existing?.id || this.pendingCreateId, patientName: raw.patientName.trim(),
        amount, cashGiven, cashReturn: raw.paymentMethod === 'cash' ? Math.max(0, Math.round(cashGiven * 100) - Math.round(amount * 100)) / 100 : 0,
        staffName: raw.staffName.trim(), shiftName: raw.shiftName.trim(), counterName: raw.counterName.trim(),
        createdAt: existing?.createdAt || (!wasEditing ? now : undefined), updatedAt: now,
        updatedById: this.identity.id, updatedByEmail: this.identity.email };
      this.validateCompletedCash(payment);
      if (!wasEditing) {
        if (!this.pendingCreateId) this.pendingCreateId = String(await this.indexedDbService.allocateId('payments'));
        payment.id = this.pendingCreateId;
        payment.recordedById = this.identity.id; payment.recordedByEmail = this.identity.email;
      }
      await this.indexedDbService.upsertRecord('payments', payment.id, payment);
      if (!wasEditing) this.rememberCounter(payment);
      this.resetForm();
      this.successMessage = wasEditing ? 'Payment updated.' : 'Payment #' + payment.id + ' saved.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
      try { await this.refreshPaymentList(); }
      catch { this.errorMessage = 'Payment saved. The history could not refresh; use Refresh to reload it.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
      if (!wasEditing && this.printAfterSave) this.showReceipt(payment);
      setTimeout(() => { if (!this.destroyed) document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    } catch (error) { this.errorMessage = this.message(error, 'Unable to save the payment. Please try again.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.saving = false; }
  }

  private rememberCounter(payment: PaymentRecord): void {
    this.context = { staffName: payment.staffName || '', shiftName: payment.shiftName || '', counterName: payment.counterName || '' };
    this.counterDate = payment.shiftDate || localPaymentDate();
    try { localStorage.setItem('hmc.paymentCounter.' + this.identity!.id, JSON.stringify(this.context)); } catch { /* Continue without saved defaults. */ }
  }
  async refreshPaymentList(): Promise<void> { await this.loadPayments(); }
  async refresh(): Promise<void> {
    this.errorMessage = '';
    try { await this.loadPayments(); } catch (error) { this.errorMessage = this.message(error, 'Unable to refresh payments.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
  }
  showReceipt(payment: PaymentRecord): void {
    try { localStorage.setItem('hmc.paymentPaperWidth', String(this.paperWidth)); } catch { /* Keep this print selection in memory. */ }
    printThermal(buildPaymentReceipt(payment), this.paperWidth, 'payment-receipt', this.feedback);
  }

  async updatePaymentStatus(paymentId: string, newStatus: string, select?: { value: string }): Promise<void> {
    const previous = this.payments.find(item => item.id === paymentId);
    if (!previous) return;
    if (this.saving || this.deletingId || !this.identity || !['completed', 'pending', 'failed'].includes(newStatus)) {
      if (select) select.value = previous.paymentStatus || ''; return;
    }
    this.saving = true; this.errorMessage = ''; this.successMessage = '';
    try {
      const current = (await this.indexedDbService.getItem<PaymentRecord[]>('payments') || []).find(item => item.id === paymentId);
      if (!current) throw new Error('This payment no longer exists. Refresh the payment list.');
      const updated = { ...current, paymentStatus: newStatus, updatedAt: new Date().toISOString(), updatedById: this.identity.id, updatedByEmail: this.identity.email };
      this.validateCompletedCash(updated);
      await this.indexedDbService.upsertRecord('payments', paymentId, updated);
      this.payments = this.payments.map(item => item.id === paymentId ? updated : item);
      this.applyPaymentFilter(false);
      this.successMessage = 'Payment status updated.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
      try { await this.refreshPaymentList(); } catch { this.errorMessage = 'Status saved. Refresh the history to see the latest records.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    } catch (error) {
      if (select) select.value = previous.paymentStatus || '';
      this.errorMessage = this.message(error, 'Unable to update payment status.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
    } finally { this.saving = false; }
  }

  get staffOptions(): string[] { return [...new Set(this.payments.map(item => item.staffName?.trim()).filter((value): value is string => !!value))].sort(); }
  get shiftOptions(): string[] { return [...new Set(this.payments.map(item => item.shiftName?.trim()).filter((value): value is string => !!value))].sort(); }
  get filteredPayments(): PaymentRecord[] {
    const query = this.paymentSearch.trim().toLocaleLowerCase();
    return this.payments.filter(payment => (!query || [payment.patientName, payment.patientId, payment.id, payment.paymentMethod, payment.paymentStatus, payment.staffName, payment.counterName, payment.shiftName, payment.shiftDate]
      .some(value => String(value || '').toLocaleLowerCase().includes(query)))
      && (!this.staffFilter || (this.staffFilter === '__unrecorded__' ? !payment.staffName : payment.staffName === this.staffFilter))
      && (!this.shiftFilter || (this.shiftFilter === '__unrecorded__' ? !payment.shiftName : payment.shiftName === this.shiftFilter))
      && (!this.statusFilter || payment.paymentStatus === this.statusFilter) && (!this.methodFilter || payment.paymentMethod === this.methodFilter)
      && (!this.fromDate || paymentDate(payment) >= this.fromDate) && (!this.toDate || (!!paymentDate(payment) && paymentDate(payment) <= this.toDate)));
  }
  get totals(): ReturnType<typeof collectionTotals> { return collectionTotals(this.filteredPayments); }
  applyPaymentFilter(reset = true): void { if (reset) this.pagination.reset(); this.displayedPayments = this.pagination.slice(this.filteredPayments); }
  clearFilters(): void { this.paymentSearch = this.staffFilter = this.shiftFilter = this.statusFilter = this.methodFilter = this.fromDate = this.toDate = ''; this.applyPaymentFilter(); }
  todayOnly(): void { this.fromDate = this.toDate = localPaymentDate(); this.applyPaymentFilter(); }
  get dateRangeInvalid(): boolean { return !!this.fromDate && !!this.toDate && this.fromDate > this.toDate; }
  exportToExcel(): void {
    exportRecords(this.filteredPayments.map(payment => ({ 'Receipt #': payment.id, 'Patient': payment.patientName, 'Patient ID': payment.patientId || '',
      'Date / time': payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-PK', { hour12: true }) : 'Not recorded', 'Counter staff': payment.staffName || 'Not recorded',
      'Shift': payment.shiftName || 'Not recorded', 'Shift date': payment.shiftDate || 'Not recorded', 'Counter': payment.counterName || '',
      'Amount (Rs)': payment.amount, 'Cash tendered (Rs)': payment.cashGiven ?? '', 'Change (Rs)': payment.cashReturn ?? '', 'Method': payment.paymentMethod || '', 'Status': payment.paymentStatus || '',
      'Recorded by account': payment.recordedByEmail || 'Not recorded', 'Updated by account': payment.updatedByEmail || 'Not recorded', 'Updated at': payment.updatedAt || '' })), 'payments.xlsx', 'Payments', this.feedback);
  }
  editPayment(payment: PaymentRecord): void {
    if (this.saving || this.deletingId) return;
    this.editingId = payment.id; this.patientId = payment.patientId || '';
    this.attributionValidators(true);
    this.paymentForm.reset({ patientName: payment.patientName, patientId: this.patientId, amount: payment.amount, cashGiven: payment.cashGiven ?? null,
      paymentMethod: payment.paymentMethod || 'cash', paymentStatus: payment.paymentStatus || 'pending', staffName: payment.staffName || '',
      shiftName: payment.shiftName || '', shiftDate: payment.shiftDate || '', counterName: payment.counterName || '' });
    this.errorMessage = ''; this.successMessage = ''; this.calculateCashReturn();
    document.getElementById('payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async deletePayment(payment: PaymentRecord): Promise<void> {
    if (!this.isSuperAdmin || this.saving || this.deletingId || !window.confirm('Delete payment #' + payment.id + ' for ' + payment.patientName + '?')) return;
    this.deletingId = payment.id; this.errorMessage = ''; this.successMessage = '';
    try {
      await this.indexedDbService.deleteRecord('payments', payment.id);
      this.payments = this.payments.filter(item => item.id !== payment.id); this.applyPaymentFilter(false);
      if (this.editingId === payment.id) this.resetForm(); this.successMessage = 'Payment deleted.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
    } catch (error) { this.errorMessage = this.message(error, 'Unable to delete payment.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.deletingId = ''; }
  }
  resetForm(): void {
    if (!this.editingId) {
      const raw = this.paymentForm.getRawValue();
      this.context = { staffName: raw.staffName || '', shiftName: raw.shiftName || '', counterName: raw.counterName || '' };
      this.counterDate = raw.shiftDate || localPaymentDate();
    }
    this.editingId = ''; this.pendingCreateId = ''; this.attributionValidators(false);
    this.paymentForm.reset({ patientName: '', patientId: this.generatePatientId(), amount: null, cashGiven: null, paymentMethod: 'cash', paymentStatus: 'completed',
      ...this.context, shiftDate: this.counterDate });
    this.cashReturn = 0;
  }
}
