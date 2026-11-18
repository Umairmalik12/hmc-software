import { ChangeDetectorRef } from '@angular/core';
import { SupabaseDataService, PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { PatientTokenComponent } from './patient-token.component';

describe('PatientTokenComponent', () => {
  let component: PatientTokenComponent;
  let supabase: jasmine.SpyObj<SupabaseDataService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;

  const slip: PatientTokenSlip = {
    id: 1,
    tokenNumber: 'A001',
    sequence: 1,
    customerName: 'Ali Khan',
    date: '2026-11-10',
    time: '10:30 AM',
    createdAt: '2026-11-10T05:30:00.000Z',
  };

  beforeEach(() => {
    supabase = jasmine.createSpyObj<SupabaseDataService>(
      'SupabaseDataService',
      ['createPatientToken', 'getAllPatientTokens', 'deletePatientToken', 'updatePatientTokenName']
    );
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new PatientTokenComponent(supabase, changeDetector);
  });

  it('filters history to the selected date and formats it for display', () => {
    component.slips = [
      slip,
      { ...slip, id: 2, tokenNumber: 'A001', date: '2026-11-11', createdAt: '2026-11-11T05:30:00.000Z' },
    ];

    component.filterByDate('2026-11-10');

    expect(component.selectedDateTotal).toBe(1);
    expect(component.historyGroups.length).toBe(1);
    expect(component.historyGroups[0].slips[0].customerName).toBe('Ali Khan');
    expect(component.formatDate('2026-11-10')).toBe('10-11-2026');
  });

  it('updates the patient name while retaining the token identity, date and time', async () => {
    const saved = { ...slip, customerName: 'Updated name' };
    supabase.updatePatientTokenName.and.resolveTo(saved);
    component.slips = [slip];
    component.selectedSlip = slip;
    component.filterByDate(slip.date);
    component.editSlip(slip);
    component.editedPatientName = 'Updated name';
    await component.saveSlip(slip);
    expect(supabase.updatePatientTokenName).toHaveBeenCalledWith(slip.id, 'Updated name');
    expect(component.slips[0]).toEqual(saved);
    expect(component.selectedSlip!.tokenNumber).toBe(slip.tokenNumber);
    expect(component.selectedSlip!.date).toBe(slip.date);
    expect(component.selectedSlip!.time).toBe(slip.time);
    expect(component.editingSlipId).toBeNull();
  });

  it('rejects an empty patient name without creating a token', async () => {
    component.customerName = '  ';

    await component.generateSlip();

    expect(supabase.createPatientToken).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('patient name');
  });

  it('automatically prints a successfully generated token', async () => {
    supabase.createPatientToken.and.returnValue(Promise.resolve(slip));
    supabase.getAllPatientTokens.and.returnValue(Promise.resolve([slip]));
    const printSpy = spyOn<any>(component, 'printSelectedSlip');
    component.customerName = 'Ali Khan';
    component.today = slip.date;

    await component.generateSlip();

    expect(component.lastGeneratedToken).toBe('A001');
    expect(component.todayTotal).toBe(1);
    expect(component.successMessage).toContain('A001');
    expect(printSpy).toHaveBeenCalled();
    expect(component.selectedSlip).toBe(slip);
  });

  it('prints the selected saved token independently of stale receipt markup', () => {
    const source = document.createElement('section');
    source.id = 'patient-token-slip-print';
    source.textContent = 'Previous token';
    document.body.appendChild(source);
    changeDetector.detectChanges.and.callFake(() => {
      source.textContent = component.selectedSlip!.tokenNumber;
    });
    const write = jasmine.createSpy('write');
    const popup = {
      document: { open: () => {}, write, close: () => {}, readyState: 'loading' },
      addEventListener: () => {},
    } as unknown as Window;
    spyOn(window, 'open').and.returnValue(popup);

    try {
      component.printSlip(slip);

      expect(write.calls.mostRecent().args[0]).toContain('A001');
      expect(write.calls.mostRecent().args[0]).not.toContain('Previous token');
    } finally {
      source.remove();
    }
  });
  it('shows all dates by default, searches across dates and paginates the complete result', () => {
    component.today = '2026-11-11';
    component.slips = Array.from({ length: 45 }, (_, index) => ({ ...slip, id: index + 1, sequence: index + 1,
      date: index < 23 ? '2026-11-10' : '2026-11-11', customerName: index === 0 ? 'Older patient' : 'Patient ' + index }));
    component.searchHistory();
    expect(component.selectedDate).toBe(''); expect(component.filteredSlips.length).toBe(45);
    expect(component.historyGroups[0].date).toBe(''); expect(component.historyGroups[0].slips.length).toBe(20);
    expect(component.historyGroups[0].slips[0].date).toBe('2026-11-11');
    component.loadMore(); expect(component.historyGroups[0].slips.length).toBe(40);
    component.filterByDate('2026-11-10'); expect(component.filteredSlips.length).toBe(23); expect(component.historyGroups[0].slips.length).toBe(20);
    component.filterByDate(''); expect(component.filteredSlips.length).toBe(45);
    component.search = 'older'; component.searchHistory(); expect(component.filteredSlips.map(row => row.id)).toEqual([1]);
    component.showToday(); expect(component.historyGroups.length).toBe(0);
    component.showAllTokens(); expect(component.search).toBe(''); expect(component.selectedDateTotal).toBe(45); expect(component.historyGroups[0].slips.length).toBe(20);
  });

  it('keeps all dates selected as the clock ticks and only advances an explicit Today filter at midnight', async () => {
    jasmine.clock().install(); supabase.getAllPatientTokens.and.resolveTo([]);
    try {
      jasmine.clock().mockDate(new Date('2026-11-19T18:59:59Z'));
      (component as any).updateClock(); expect(component.today).toBe('2026-11-19'); expect(component.selectedDate).toBe('');
      component.showToday();
      jasmine.clock().mockDate(new Date('2026-11-19T19:00:01Z'));
      (component as any).updateClock(); expect(component.selectedDate).toBe('2026-11-20'); await Promise.resolve();
      component.showAllTokens(); (component as any).updateClock(); expect(component.selectedDate).toBe('');
      jasmine.clock().mockDate(new Date('2026-11-20T19:00:01Z'));
      (component as any).updateClock(); expect(component.selectedDate).toBe(''); await Promise.resolve();
    } finally { component.ngOnDestroy(); jasmine.clock().uninstall(); }
  });

  it('confirms deletion of an older token and removes only that record from the all-dates list', async () => {
    const newer = { ...slip, id: 2, date: '2026-11-11' }; component.slips = [slip, newer]; component.showAllTokens();
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    await component.deleteSlip(slip); expect(supabase.deletePatientToken).not.toHaveBeenCalled();
    confirm.and.returnValue(true); supabase.deletePatientToken.and.resolveTo(); supabase.getAllPatientTokens.and.resolveTo([newer]);
    await component.deleteSlip(slip); await Promise.resolve();
    expect(supabase.deletePatientToken).toHaveBeenCalledWith(slip.id); expect(component.filteredSlips.map(row => row.id)).toEqual([2]);
    expect(component.historicalTotal).toBe(1); expect(component.selectedDate).toBe('');
  });

});
