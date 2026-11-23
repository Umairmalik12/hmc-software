import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { StaffIdentity, UserLoginService } from 'src/app/Services/user-login.service';
import { requiredText } from 'src/app/Services/validators.service';
import { exportRecords } from 'src/app/Shared/export-records';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { collectionTotals, localPaymentDate, moneyCents, PaymentRecord, paymentDate, validMoney, validShiftDate } from './payment-record';
import { PaymentSlipPreviewComponent } from './payment-slip-preview.component';
import { StaffService, STAFF_COLLECTION } from 'src/app/Services/staff.service';
import { StaffRecord, STAFF_SHIFTS, staffKey, uniqueStaffValues } from 'src/app/Models/staff.model';
import { selectedDateTime, validSelectedDateTime } from 'src/app/Shared/date-time-values';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';
import { replacePatientPrefill } from 'src/app/Shared/patient-lookup-form';

@Component({ selector: 'app-payment', templateUrl: './payment.component.html', styleUrls: ['./payment.component.css'] })
export class PaymentComponent implements OnInit, OnDestroy {
  paymentForm!: FormGroup;
  payments: PaymentRecord[] = [];
  displayedPayments: PaymentRecord[] = [];
  displayedColumns = ['patientName', 'createdAt', 'staff', 'amount', 'cash', 'paymentMethod', 'paymentStatus', 'actions'];
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  staffRecords: StaffRecord[] = [];
  staffLoading = false;
  staffLoadError = '';
  staffLoaded = false;
  private staffVersion = 0;
  private editingStaffName = '';
  readonly unrecordedStaffLabel = 'Not recorded (older payments)';
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
  private pendingCreateId = '';
  private loadVersion = 0;
  private destroyed = false;
  private subscriptions = new Subscription();
  matchedPatient = '';
  private patientPrefill: Record<string, unknown> = {};
  private patientLookupVersion = 0;
  private clock?: ReturnType<typeof setInterval>;

  constructor(private fb: FormBuilder, private indexedDbService: SupabaseDataService, private user: UserLoginService, private feedback: NotifyUpdateService = new NotifyUpdateService(), @Optional() @Inject(MatDialog) private dialog: MatDialog | null = null,
    private staff: StaffService = new StaffService(indexedDbService), @Optional() private patientLookup: PatientLookupService | null = null) {}

  async ngOnInit(): Promise<void> {
    this.paymentForm = this.fb.group({
      patientName: ['', [requiredText, Validators.maxLength(120)]],
      mrNumber: [null, [Validators.min(1)]],
      patientId: [{ value: this.generatePatientId(), disabled: true }],
      amount: [null, [Validators.required, validMoney]],
      cashGiven: [null, validMoney],
      paymentMethod: ['cash', [Validators.required, Validators.pattern(/^(cash|card)$/)]],
      paymentStatus: ['completed', [Validators.required, Validators.pattern(/^(completed|pending|failed)$/)]],
      staffName: ['', [requiredText, Validators.maxLength(120), this.validStaffSelection]],
      shiftName: ['', [requiredText, Validators.maxLength(60)]],
      shiftDate: ['', [Validators.required, validShiftDate]],
      createdAt: ['', validSelectedDateTime],
      counterName: ['', Validators.maxLength(60)],
    });
    this.subscriptions.add(this.paymentForm.valueChanges.subscribe(() => this.calculateCashReturn()));
    this.subscriptions.add(this.paymentForm.get('mrNumber')!.valueChanges.subscribe(value => { if (!this.editingId) void this.lookupPatient(value); }));
    this.subscriptions.add(this.paymentForm.get('paymentMethod')!.valueChanges.subscribe(method => {
      this.paymentForm.get('cashGiven')!.setValidators(method === 'cash' ? [validMoney] : []);
      this.paymentForm.get('cashGiven')!.updateValueAndValidity({ emitEvent: false });
    }));
    this.subscriptions.add(this.indexedDbService.changes.subscribe(collection => {
      if (collection === 'payments') void this.loadPayments().catch(error => { this.errorMessage = this.message(error, 'Unable to refresh payments.'); this.feedback.error(this.errorMessage); });
      if (collection === STAFF_COLLECTION) void this.loadStaff();
    }));
    this.clock = setInterval(() => this.currentTime = new Date(), 1000);
    await Promise.all([this.loadAccount(), this.loadStaff(), this.loadPayments().catch(error => { this.errorMessage = this.message(error, 'Unable to load payments.'); this.feedback.error(this.errorMessage); })]);
    this.restoreStaffDefault();
  }

  private readonly validStaffSelection = (control: AbstractControl): { staff: boolean } | null => {
    const name = staffKey(control.value);
    return !name || (!!this.editingId && name === staffKey(this.editingStaffName)) || this.staffRecords.some(record => record.active && staffKey(record.name) === name) ? null : { staff: true };
  };
  get activeStaffNames(): string[] { return uniqueStaffValues(this.staffRecords.filter(record => record.active).map(record => record.name)); }
  get staffEntryOptions(): string[] { return uniqueStaffValues([...this.activeStaffNames, ...(this.editingId ? [this.editingStaffName] : [])]); }
  get shiftSuggestions(): string[] {
    const selected = staffKey(this.paymentForm?.get('staffName')?.value);
    return uniqueStaffValues([...STAFF_SHIFTS, ...this.staffRecords.filter(record => record.active && staffKey(record.name) === selected).flatMap(record => record.assignments.map(assignment => assignment.shift))]);
  }
  selectStaff(name: string): void { const control = this.paymentForm.get('staffName')!; control.setValue(name); control.markAsDirty(); control.markAsTouched(); }
  async loadStaff(): Promise<void> {
    const version = ++this.staffVersion; this.staffLoading = true;
    try {
      const records = await this.staff.getAll(true);
      if (!this.destroyed && version === this.staffVersion) {
        this.staffRecords = records; this.staffLoaded = true; this.staffLoadError = '';
        const control = this.paymentForm.get('staffName'); control?.updateValueAndValidity({ emitEvent: false });
        if (!this.accountLoading && !control?.dirty) this.restoreStaffDefault();
      }
    } catch { if (!this.destroyed && version === this.staffVersion) { this.staffLoadError = 'Unable to load staff. Use Retry to refresh the staff list.'; this.feedback.error(this.staffLoadError); } }
    finally { if (!this.destroyed && version === this.staffVersion) this.staffLoading = false; }
  }
  private restoreStaffDefault(): void {
    if (this.editingId || !this.staffLoaded || this.staffLoadError) return;
    const selected = this.staffRecords.find(record => record.active && staffKey(record.name) === staffKey(this.context.staffName));
    this.context.staffName = selected?.name || '';
    this.paymentForm.get('staffName')!.setValue(this.context.staffName, { emitEvent: false });
  }
  get staffFilterOptions(): string[] { return [...this.staffOptions, this.unrecordedStaffLabel]; }
  get staffFilterValue(): string { return this.staffFilter === '__unrecorded__' ? this.unrecordedStaffLabel : this.staffFilter; }
  selectStaffFilter(name: string): void { this.staffFilter = name === this.unrecordedStaffLabel ? '__unrecorded__' : name; this.applyPaymentFilter(); }

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

  async retryAccount(): Promise<void> { this.accountLoading = true; await this.loadAccount(); this.restoreStaffDefault(); }

  ngOnDestroy(): void { this.destroyed = true; this.loadVersion++; this.staffVersion++; this.subscriptions.unsubscribe(); if (this.clock) clearInterval(this.clock); }
  private message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.patientLookupVersion, mr = Number(value); this.matchedPatient = '';
    this.patientPrefill = replacePatientPrefill(this.paymentForm, this.patientPrefill, {});
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.patientLookupVersion || Number(this.paymentForm.get('mrNumber')!.value) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      this.patientPrefill = replacePatientPrefill(this.paymentForm, {}, { patientName: name });
      this.matchedPatient = name;
    } catch { if (version === this.patientLookupVersion) this.matchedPatient = ''; }
  }
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
      if (field === 'staffName') this.paymentForm.get(field)!.addValidators(this.validStaffSelection);
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
    if (this.staffLoading || !this.staffLoaded || this.staffLoadError) { this.errorMessage = 'Load the staff list before saving this payment. Use Retry on the staff dropdown.'; this.feedback.error(this.errorMessage); return; }
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
      const payment: PaymentRecord = { ...existing, ...raw, mrNumber: raw.mrNumber ? Number(raw.mrNumber) : undefined, id: existing?.id || this.pendingCreateId, patientName: raw.patientName.trim(),
        amount, cashGiven, cashReturn: raw.paymentMethod === 'cash' ? Math.max(0, Math.round(cashGiven * 100) - Math.round(amount * 100)) / 100 : 0,
        staffName: raw.staffName.trim(), shiftName: raw.shiftName.trim(), counterName: raw.counterName.trim(),
        createdAt: selectedDateTime(raw.createdAt) || (wasEditing && existing?.createdAt == null ? existing?.createdAt : ''), updatedAt: now,
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
      if (!wasEditing && this.printAfterSave) await this.showReceipt(payment);
      setTimeout(() => { if (!this.destroyed) document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    } catch (error) { this.errorMessage = this.message(error, 'Unable to save the payment. Please try again.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.saving = false; }
  }

  private rememberCounter(payment: PaymentRecord): void {
    this.context = { staffName: payment.staffName || '', shiftName: payment.shiftName || '', counterName: payment.counterName || '' };
    try { localStorage.setItem('hmc.paymentCounter.' + this.identity!.id, JSON.stringify(this.context)); } catch { /* Continue without saved defaults. */ }
  }
  async refreshPaymentList(): Promise<void> { await this.loadPayments(); }
  async refresh(): Promise<void> {
    this.errorMessage = '';
    try { await this.loadPayments(); } catch (error) { this.errorMessage = this.message(error, 'Unable to refresh payments.'); if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
  }
  changePaperWidth(width: 58 | 80): void {
    this.paperWidth = width === 80 ? 80 : 58;
    try { localStorage.setItem('hmc.paymentPaperWidth', String(this.paperWidth)); } catch { /* Keep this print selection in memory. */ }
  }
  async showReceipt(payment: PaymentRecord): Promise<void> {
    try {
      if (!this.dialog) throw new Error('Payment preview could not be opened. Refresh the page and try again.');
      const record = (await this.indexedDbService.getItem<PaymentRecord[]>('payments') || []).find(item => item.id === payment.id);
      if (!record) throw new Error('This payment no longer exists. Refresh the payment list.');
      if (this.destroyed) return;
      this.changePaperWidth(this.paperWidth);
      const preview = this.dialog.open(PaymentSlipPreviewComponent, { data: { record: { ...record }, paperWidth: this.paperWidth }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
      this.subscriptions.add(preview.beforeClosed().subscribe(() => { if (!this.destroyed) this.paperWidth = preview.componentInstance.paperWidth; }));
    } catch (error) { this.errorMessage = this.message(error, 'Unable to load the payment receipt.'); this.feedback.error(this.errorMessage); }
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

  get staffOptions(): string[] { return uniqueStaffValues([...this.staffRecords.map(record => record.name), ...this.payments.map(item => item.staffName || '')]); }
  get shiftOptions(): string[] { return [...new Set(this.payments.map(item => item.shiftName?.trim()).filter((value): value is string => !!value))].sort(); }
  get filteredPayments(): PaymentRecord[] {
    const query = this.paymentSearch.trim().toLocaleLowerCase();
    return this.payments.filter(payment => (!query || [payment.patientName, payment.patientId, payment.mrNumber, payment.id, payment.paymentMethod, payment.paymentStatus, payment.staffName, payment.counterName, payment.shiftName, payment.shiftDate]
      .some(value => String(value || '').toLocaleLowerCase().includes(query)))
      && (!this.staffFilter || (this.staffFilter === '__unrecorded__' ? !staffKey(payment.staffName) : staffKey(payment.staffName) === staffKey(this.staffFilter)))
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
    exportRecords(this.filteredPayments.map(payment => ({ 'Receipt #': payment.id, 'Patient': payment.patientName, 'MR Number': payment.mrNumber || '', 'Patient ID': payment.patientId || '',
      'Date / time': payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-PK', { hour12: true }) : 'Not recorded', 'Counter staff': payment.staffName || 'Not recorded',
      'Shift': payment.shiftName || 'Not recorded', 'Shift date': payment.shiftDate || 'Not recorded', 'Counter': payment.counterName || '',
      'Amount (Rs)': payment.amount, 'Cash tendered (Rs)': payment.cashGiven ?? '', 'Change (Rs)': payment.cashReturn ?? '', 'Method': payment.paymentMethod || '', 'Status': payment.paymentStatus || '',
      'Recorded by account': payment.recordedByEmail || 'Not recorded', 'Updated by account': payment.updatedByEmail || 'Not recorded', 'Updated at': payment.updatedAt || '' })), 'payments.xlsx', 'Payments', this.feedback);
  }
  editPayment(payment: PaymentRecord): void {
    if (this.saving || this.deletingId) return;
    this.editingId = payment.id; this.editingStaffName = payment.staffName || ''; this.patientId = payment.patientId || '';
    this.attributionValidators(true);
    this.paymentForm.reset({ patientName: payment.patientName, mrNumber: payment.mrNumber ?? null, patientId: this.patientId, amount: payment.amount, cashGiven: payment.cashGiven ?? null,
      paymentMethod: payment.paymentMethod || 'cash', paymentStatus: payment.paymentStatus || 'pending', staffName: payment.staffName || '',
      shiftName: payment.shiftName || '', shiftDate: payment.shiftDate || '', createdAt: payment.createdAt || '', counterName: payment.counterName || '' });
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
    }
    this.editingId = ''; this.editingStaffName = ''; this.pendingCreateId = ''; this.attributionValidators(false);
    this.matchedPatient = ''; this.patientPrefill = {}; this.paymentForm.reset({ patientName: '', mrNumber: null, patientId: this.generatePatientId(), amount: null, cashGiven: null, paymentMethod: 'cash', paymentStatus: 'completed',
      ...this.context, shiftDate: '', createdAt: '' });
    this.restoreStaffDefault();
    this.cashReturn = 0;
  }
}
