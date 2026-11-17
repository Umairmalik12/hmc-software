import { FormBuilder } from '@angular/forms';
import { PaymentComponent } from './payment.component';
import { StaffIdentity, UserLoginService } from 'src/app/Services/user-login.service';
import { memoryDb } from 'src/app/testing/memory-db';
import { PaymentRecord } from './payment-record';

describe('Payment counter and CRUD', () => {
  const identity: StaffIdentity = { id: 'payment-test-staff', name: 'Ayesha', email: 'ayesha@example.test' };
  let component: PaymentComponent;
  let store: ReturnType<typeof memoryDb>;
  async function setup(): Promise<void> {
    store = memoryDb();
    component = new PaymentComponent(new FormBuilder(), store.db, { getLoginUser: async () => 'admin', getStaffIdentity: async () => identity } as UserLoginService);
    await component.ngOnInit(); component.printAfterSave = false;
  }
  const fill = (values: object = {}): void => component.paymentForm.patchValue({ patientName: 'Ali', amount: 100, shiftName: 'Night', ...values });
  const stored = (): PaymentRecord[] => Array.from(store.collections.get('payments')?.values() || []);
  beforeEach(() => localStorage.removeItem('hmc.paymentCounter.' + identity.id));
  afterEach(() => { component?.ngOnDestroy(); localStorage.removeItem('hmc.paymentCounter.' + identity.id); });

  it('saves staff, shift and account attribution, edits with a stable ID and deletes only the chosen payment', async () => {
    await setup();
    const other = { id: '70', patientName: 'Another patient', amount: 50, paymentStatus: 'pending', createdAt: '2020-01-01T00:00:00Z' };
    store.collections.set('payments', new Map([['70', other]]));
    fill({ cashGiven: 150, counterName: 'Reception 1', shiftDate: '2026-11-16' });
    await component.processPayment();
    const saved = stored().find(record => record.patientName === 'Ali')!;
    expect(saved.cashReturn).toBe(50); expect(saved.staffName).toBe('Ayesha'); expect(saved.shiftName).toBe('Night');
    expect(saved.shiftDate).toBe('2026-11-16'); expect(saved.counterName).toBe('Reception 1');
    expect(saved.recordedById).toBe(identity.id); expect(saved.recordedByEmail).toBe(identity.email);
    expect(Number.isNaN(new Date(saved.createdAt!).getTime())).toBeFalse();
    expect(component.paymentForm.get('shiftDate')!.value).toBe('2026-11-16'); // Overnight context survives the next patient.
    component.identity = { id: 'second-staff', name: 'Bilal', email: 'bilal@example.test' };
    component.editPayment(saved); component.paymentForm.get('amount')!.setValue(125);
    await component.processPayment();
    const updated = stored().find(record => record.id === saved.id)!;
    expect(updated.cashReturn).toBe(25); expect(updated.createdAt).toBe(saved.createdAt);
    expect(updated.staffName).toBe('Ayesha'); expect(updated.recordedById).toBe(identity.id);
    expect(updated.updatedById).toBe('second-staff'); expect(store.db.allocateId).toHaveBeenCalledTimes(1);
    spyOn(window, 'confirm').and.returnValue(true); await component.deletePayment(updated);
    expect(stored()).toEqual([other]); expect(store.db.setItem).not.toHaveBeenCalled();
  });

  it('requires staff and shift only for new entries and uses exact cash when the tendered field is blank', async () => {
    await setup(); component.paymentForm.patchValue({ patientName: 'Ali', amount: 0.3 });
    await component.processPayment(); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    fill({ amount: 0.3 }); await component.processPayment();
    expect(stored()[0].cashGiven).toBe(0.3); expect(stored()[0].cashReturn).toBe(0);
    expect(component.paymentForm.get('staffName')!.value).toBe('Ayesha'); expect(component.paymentForm.get('shiftName')!.value).toBe('Night');
  });

  it('rejects underpaid completed cash, invalid precision and negative values without allocating an ID', async () => {
    await setup();
    for (const values of [{ amount: 100, cashGiven: 90 }, { amount: 1.001 }, { amount: -1 }, { amount: 100, cashGiven: -2 }]) {
      component.resetForm(); fill(values); await component.processPayment();
    }
    expect(store.db.upsertRecord).not.toHaveBeenCalled(); expect(store.db.allocateId).not.toHaveBeenCalled();
    fill({ amount: 0.3, cashGiven: 0.5 }); await component.processPayment(); expect(stored()[0].cashReturn).toBe(0.2);
  });

  it('records pending cash without inventing cash received and excludes card cash values', async () => {
    await setup(); fill({ paymentStatus: 'pending' }); await component.processPayment(); expect(stored()[0].cashGiven).toBe(0);
    fill({ patientName: 'Card patient', paymentMethod: 'card', cashGiven: -20 });
    expect(component.paymentForm.valid).toBeTrue(); await component.processPayment();
    const card = stored().find(record => record.patientName === 'Card patient')!;
    expect(card.cashGiven).toBe(0); expect(card.cashReturn).toBe(0);
    expect(component.totals.cash).toBe(0); expect(component.totals.card).toBe(100); expect(component.totals.pending).toBe(100);
  });

  it('preserves unrecorded legacy attribution when edited by a later staff member', async () => {
    await setup(); const legacy = { id: '1', patientName: 'Old patient', amount: 10, paymentMethod: 'cash', paymentStatus: 'pending' };
    store.collections.set('payments', new Map([['1', legacy]]));
    component.editPayment(legacy); expect(component.paymentForm.valid).toBeTrue(); await component.processPayment();
    expect(stored()[0].recordedById).toBeUndefined(); expect(stored()[0].createdAt).toBeUndefined();
    expect(stored()[0].staffName).toBe(''); expect(stored()[0].shiftName).toBe(''); expect(stored()[0].updatedById).toBe(identity.id);
    expect(component.paymentForm.get('staffName')!.value).toBe(identity.name);
  });

  it('keeps the draft and reuses its allocated ID when saving fails, without duplicate submit writes', async () => {
    await setup(); fill();
    (store.db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('offline'));
    await component.processPayment(); expect(component.errorMessage).toBe('offline'); expect(component.paymentForm.get('patientName')!.value).toBe('Ali');
    (store.db.upsertRecord as jasmine.Spy).and.callFake(async () => {});
    const first = component.processPayment(); await component.processPayment(); await first;
    expect(store.db.allocateId).toHaveBeenCalledTimes(1); expect(store.db.upsertRecord).toHaveBeenCalledTimes(2);
  });

  it('filters staff, shift date and status across all rows, with full totals beyond the rendered batch', async () => {
    await setup();
    component.payments = Array.from({ length: 65 }, (_, id) => ({ id: String(id), patientName: 'Patient ' + id, amount: 0.1,
      paymentMethod: 'cash', paymentStatus: 'completed', staffName: id < 40 ? 'Ayesha' : 'Bilal', shiftName: 'Night', shiftDate: '2026-11-16', createdAt: '2026-11-17T00:30:00Z' }));
    component.staffFilter = 'Ayesha'; component.shiftFilter = 'Night'; component.fromDate = component.toDate = '2026-11-16';
    component.applyPaymentFilter(); expect(component.displayedPayments.length).toBe(20); expect(component.filteredPayments.length).toBe(40); expect(component.totals.cash).toBe(4);
    component.loadMore(); expect(component.displayedPayments.length).toBe(40);
    component.staffFilter = 'Bilal'; component.applyPaymentFilter(); expect(component.displayedPayments.length).toBe(20); expect(component.totals.cash).toBe(2.5);
    component.statusFilter = 'pending'; component.applyPaymentFilter(); expect(component.filteredPayments.length).toBe(0);
    component.clearFilters(); expect(component.filteredPayments.length).toBe(65); expect(component.displayedPayments.length).toBe(20);
  });

  it('merges a status change into the latest record without overwriting concurrent staff corrections', async () => {
    await setup();
    const current = { id: '1', patientName: 'Corrected', amount: 50, paymentMethod: 'cash', cashGiven: 50, paymentStatus: 'pending', staffName: 'Original staff', recordedById: 'original-account' };
    store.collections.set('payments', new Map([['1', current]]));
    component.payments = [{ ...current, patientName: 'Stale name' }];
    await component.updatePaymentStatus('1', 'completed');
    expect(stored()[0].patientName).toBe('Corrected'); expect(stored()[0].staffName).toBe('Original staff');
    expect(stored()[0].recordedById).toBe('original-account'); expect(stored()[0].updatedById).toBe(identity.id);
  });

  it('rolls back the status selection on write failure or insufficient cash', async () => {
    await setup(); const current = { id: '1', patientName: 'Ali', amount: 100, paymentMethod: 'cash', cashGiven: 50, paymentStatus: 'pending' };
    store.collections.set('payments', new Map([['1', current]])); component.payments = [current];
    const select = { value: 'completed' }; await component.updatePaymentStatus('1', 'completed', select);
    expect(select.value).toBe('pending'); expect(component.errorMessage).toContain('less than'); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    (store.db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('permission denied'));
    select.value = 'failed'; await component.updatePaymentStatus('1', 'failed', select);
    expect(select.value).toBe('pending'); expect(component.errorMessage).toBe('permission denied');
  });

  it('leaves write permissions to the authenticated account and restricts deletion in the staff UI', async () => {
    await setup(); fill(); component.identity = undefined; await component.processPayment(); expect(store.db.upsertRecord).not.toHaveBeenCalled();
    component.isSuperAdmin = false; const confirm = spyOn(window, 'confirm');
    await component.deletePayment({ id: '1', patientName: 'Ali', amount: 10 }); expect(confirm).not.toHaveBeenCalled(); expect(store.db.deleteRecord).not.toHaveBeenCalled();
  });
});
