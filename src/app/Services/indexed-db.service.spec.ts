import { TestBed } from '@angular/core/testing';

import { IndexedDbService } from './indexed-db.service';

describe('IndexedDbService', () => {
  let service: IndexedDbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedDbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('assigns unique daily tokens atomically and starts the next day at 001', async () => {
    const futureDate = new Date(Date.now() + (1000 + Math.floor(Math.random() * 20000)) * 86400000);
    const createdIds: number[] = [];
    jasmine.clock().install();
    jasmine.clock().mockDate(futureDate);

    try {
      const slips = await Promise.all([
        service.createPatientToken('Patient One'),
        service.createPatientToken('Patient Two'),
        service.createPatientToken('Patient Three'),
      ]);
      createdIds.push(...slips.map(slip => slip.id));
      expect(new Set(slips.map(slip => slip.tokenNumber)).size).toBe(3);
      expect(slips.map(slip => slip.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3]);
      expect(slips.every(slip => slip.date === slips[0].date)).toBeTrue();

      jasmine.clock().mockDate(new Date(futureDate.getTime() + 86400000));
      const nextDaySlip = await service.createPatientToken('Next Day Patient');
      createdIds.push(nextDaySlip.id);
      expect(nextDaySlip.date).not.toBe(slips[0].date);
      expect(nextDaySlip.tokenNumber).toBe('A001');
      expect((await service.getPatientTokensByDate(nextDaySlip.date)).map(slip => slip.id))
        .toEqual([nextDaySlip.id]);
    } finally {
      jasmine.clock().uninstall();
      await Promise.all(createdIds.map(id => service.deletePatientToken(id)));
    }
  });
});
