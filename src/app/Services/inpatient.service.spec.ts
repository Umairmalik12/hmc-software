import { firstValueFrom } from 'rxjs';
import { memoryDb } from '../testing/memory-db';
import { InpatientService, InPatientDetail } from './inpatient.service';

describe('Inpatient entered patient IDs', () => {
  const patient = (overrides: Partial<InPatientDetail> = {}): InPatientDetail => ({ inpatientId: 8123, patientName: 'Ali', procedure: 'Cystoscopy',
    surgeonName: '', admissionDate: '', dischargeDate: '', createdAt: '', ...overrides });

  it('creates, reads, updates and deletes the entered ID without allocating a replacement', async () => {
    const { db } = memoryDb(); const service = new InpatientService(db);
    const record = patient();
    expect(await service.addNewInpatient(record)).toBeTrue(); expect(record.inpatientId).toBe(8123);
    expect(db.insertRecord).toHaveBeenCalledWith('inpatientDetails', 8123, record); expect(db.allocateId).not.toHaveBeenCalled();
    expect(await service.updateInpatient({ ...record, patientName: 'Updated', procedure: 'Right nephrectomy' })).toBeTrue();
    expect(await firstValueFrom(service.getInpatientDetails(8123))).toEqual(jasmine.objectContaining({ inpatientId: 8123, patientName: 'Updated', procedure: 'Right nephrectomy' }));
    expect(await service.deleteInpatient(8123)).toBeTrue(); expect(await firstValueFrom(service.getInpatientDetails(8123))).toBeUndefined();
  });

  it('rejects invalid or missing IDs before creates or updates reach the database', async () => {
    const { db } = memoryDb(); const service = new InpatientService(db);
    for (const value of [undefined, null, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '8123']) {
      const record = patient({ inpatientId: value as number });
      expect(await service.addNewInpatient(record)).toBeFalse(); expect(await service.updateInpatient(record)).toBeFalse();
    }
    expect(db.getItem).not.toHaveBeenCalled(); expect(db.insertRecord).not.toHaveBeenCalled();
    expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });

  it('preserves the first admission when duplicate IDs are submitted sequentially or concurrently', async () => {
    const { db, collections } = memoryDb(); const first = new InpatientService(db); const second = new InpatientService(db);
    expect(await Promise.all([first.addNewInpatient(patient({ patientName: 'First' })), second.addNewInpatient(patient({ patientName: 'Second' }))])).toEqual([true, false]);
    expect(await first.addNewInpatient(patient({ patientName: 'Duplicate' }))).toBeFalse();
    expect(collections.get('inpatientDetails')!.get('8123').patientName).toBe('First');
    expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });

  it('reports failed inserts without retrying as an upsert or selecting another ID', async () => {
    const { db } = memoryDb(); const service = new InpatientService(db);
    (db.insertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    expect(await service.addNewInpatient(patient())).toBeFalse(); expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
  });
});
