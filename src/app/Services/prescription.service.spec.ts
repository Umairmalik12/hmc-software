import { PrescriptionService } from './prescription.service';
import { SupabaseDataService } from './supabase-data.service';
import { emptyPrescription } from '../Models/prescription.model';

describe('Prescription database records', () => {
  let service: PrescriptionService;
  let db: jasmine.SpyObj<SupabaseDataService>;
  beforeEach(() => {
    db = jasmine.createSpyObj<SupabaseDataService>('db', ['getItem', 'allocateId', 'upsertRecord', 'setItem', 'deleteRecord']);
    db.allocateId.and.resolveTo(7);
    db.upsertRecord.and.resolveTo();
    db.setItem.and.resolveTo();
    db.deleteRecord.and.resolveTo();
    service = new PrescriptionService(db);
  });

  it('creates an independent database record using the PC clock', async () => {
    const draft = emptyPrescription();
    draft.patient.name = '  Ali Khan  ';
    draft.issuedAt = '2020-01-01T00:00:00Z';
    const started = Date.now();
    const saved = await service.save(draft);
    expect(saved.id).toBe('7');
    expect(saved.patient.name).toBe('Ali Khan');
    expect(new Date(saved.issuedAt).getTime()).toBeGreaterThanOrEqual(started);
    expect(db.upsertRecord).toHaveBeenCalledWith('prescriptions', '7', saved);
    expect(db.setItem).not.toHaveBeenCalled();
    expect(draft.id).toBe('');
  });

  it('updates the same record while preserving its original issue and creation dates', async () => {
    const draft = { ...emptyPrescription(), id: '12', issuedAt: '2026-10-01T08:15:00Z', createdAt: '2026-10-01T08:15:00Z' };
    draft.patient.name = 'Ali';
    draft.patient.relation = 'Existing relation';
    draft.medicines[0].morning = true;
    const saved = await service.save(draft);
    expect(saved.issuedAt).toBe(draft.issuedAt);
    expect(saved.createdAt).toBe(draft.createdAt);
    expect(saved.patient.relation).toBe('Existing relation');
    expect(saved.medicines[0].morning).toBeTrue();
    expect(db.allocateId).not.toHaveBeenCalled();
    expect(db.upsertRecord.calls.mostRecent().args[1]).toBe('12');
  });

  it('reuses the allocated ID after a failed network response to prevent duplicate prescriptions on retry', async () => {
    const draft = emptyPrescription();
    draft.patient.name = 'Ali';
    db.upsertRecord.and.rejectWith(new Error('network error'));
    await expectAsync(service.save(draft)).toBeRejectedWithError('network error');
    db.upsertRecord.and.resolveTo();
    await service.save(draft);
    expect(db.allocateId).toHaveBeenCalledTimes(1);
    expect(db.upsertRecord.calls.allArgs().map(args => args[1])).toEqual(['7', '7']);
  });

  it('keeps the old singleton available without inventing an issue date or writing during reads', async () => {
    const old = { patient: { name: 'Earlier patient' }, medicines: [{ name: 'Medicine A', evening: true }] };
    db.getItem.and.callFake((key: string) => Promise.resolve(key === 'prescription' ? old : [] as any));
    const records = await service.getAll();
    expect(records.length).toBe(1);
    expect(records[0].id).toBe('legacy-prescription');
    expect(records[0].issuedAt).toBe('');
    expect(records[0].medicines[0].evening).toBeTrue();
    expect(db.upsertRecord).not.toHaveBeenCalled();
    expect(db.setItem).not.toHaveBeenCalled();
  });

  it('explicitly deletes only the requested record or the legacy singleton', async () => {
    await service.delete('8');
    await service.delete('legacy-prescription');
    expect(db.deleteRecord.calls.allArgs()).toEqual([['prescriptions', '8'], ['prescription', '__singleton__']]);
  });

  it('rejects a blank patient name without touching the database', async () => {
    await expectAsync(service.save(emptyPrescription())).toBeRejectedWithError('Enter the patient name before saving.');
    expect(db.allocateId).not.toHaveBeenCalled();
    expect(db.upsertRecord).not.toHaveBeenCalled();
  });
});
