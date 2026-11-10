import { IndexedDbService, PatientTokenSlip } from 'src/app/Services/indexed-db.service';
import { PatientTokenComponent } from './patient-token.component';

describe('PatientTokenComponent', () => {
  let component: PatientTokenComponent;
  let indexedDb: jasmine.SpyObj<IndexedDbService>;

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
    indexedDb = jasmine.createSpyObj<IndexedDbService>(
      'IndexedDbService',
      ['createPatientToken', 'getAllPatientTokens', 'deletePatientToken']
    );
    component = new PatientTokenComponent(indexedDb);
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

  it('rejects an empty patient name without creating a token', async () => {
    component.customerName = '  ';

    await component.generateSlip();

    expect(indexedDb.createPatientToken).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('patient name');
  });

  it('automatically prints a successfully generated token', async () => {
    indexedDb.createPatientToken.and.returnValue(Promise.resolve(slip));
    indexedDb.getAllPatientTokens.and.returnValue(Promise.resolve([slip]));
    const printSpy = spyOn(window, 'print');
    jasmine.clock().install();
    component.customerName = 'Ali Khan';

    try {
      await component.generateSlip();
      jasmine.clock().tick(150);

      expect(component.lastGeneratedToken).toBe('A001');
      expect(component.todayTotal).toBe(1);
      expect(component.successMessage).toContain('A001');
      expect(printSpy).toHaveBeenCalled();
      expect(document.body.classList.contains('patient-token-printing')).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
