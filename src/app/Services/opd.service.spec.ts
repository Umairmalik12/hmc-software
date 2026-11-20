import { firstValueFrom } from 'rxjs';
import { Opd } from '../Models/opd.model';
import { memoryDb } from '../testing/memory-db';
import { OpdService } from './opd.service';

describe('OPD manual MR persistence', () => {
  const patient = (overrides: Partial<Opd> = {}): Opd => ({ patientId: 8123, patientName: 'Ali', sex: 'Male', age: 30, procedure: 'Cystoscopy', ...overrides } as Opd);

  it('creates, edits and reads the entered MR, gender and procedure without allocating an ID', async () => {
    const { db } = memoryDb(); const service = new OpdService(db);
    expect(await service.addNewOpd(patient())).toBeTrue();
    expect(db.insertRecord).toHaveBeenCalledWith('opdDetails', 8123, jasmine.objectContaining({ patientId: 8123, sex: 'Male', procedure: 'Cystoscopy' }));
    expect(db.allocateId).not.toHaveBeenCalled();
    expect(await service.updateOpd({ ...patient({ sex: 'Female', procedure: 'Right nephrectomy' }), oldPatientId: 8123 })).toBeTrue();
    const saved = await firstValueFrom(service.getOpdDetails(8123));
    expect(saved.sex).toBe('Female'); expect(saved.procedure).toBe('Right nephrectomy'); expect(saved.patientId).toBe(8123);
    expect(await service.deleteOpd(8123)).toBeTrue();
    expect(await firstValueFrom(service.getOpdDetails(8123))).toBeUndefined();
  });

  it('rejects invalid MR, age and gender on creates and updates before database writes', async () => {
    const { db } = memoryDb(); const service = new OpdService(db);
    const invalid = [
      ...[undefined, null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '8123'].map(patientId => ({ patientId })),
      ...[-1, 121, Number.NaN, Number.POSITIVE_INFINITY].map(age => ({ age })), { sex: 'Other' }, { sex: 'Not specified' }
    ];
    for (const values of invalid) {
      const record = patient(values as Partial<Opd>);
      expect(await service.addNewOpd(record)).toBeFalse();
      expect(await service.updateOpd({ ...record, oldPatientId: 8123 })).toBeFalse();
    }
    expect(db.getItem).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
    expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled();
  });

  it('preserves existing patient data on duplicate and concurrent registrations', async () => {
    const { db, collections } = memoryDb();
    const first = new OpdService(db); const second = new OpdService(db);
    const results = await Promise.all([first.addNewOpd(patient({ patientName: 'First patient' })), second.addNewOpd(patient({ patientName: 'Second patient' }))]);
    expect(results).toEqual([true, false]);
    expect(await first.addNewOpd(patient({ patientName: 'Duplicate' }))).toBeFalse();
    expect(collections.get('opdDetails')!.get('8123').patientName).toBe('First patient');
    expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });

  it('reports failed inserts without retrying as an upsert or allocating a substitute MR', async () => {
    const { db } = memoryDb(); const service = new OpdService(db);
    (db.insertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    expect(await service.addNewOpd(patient())).toBeFalse();
    expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });
});
