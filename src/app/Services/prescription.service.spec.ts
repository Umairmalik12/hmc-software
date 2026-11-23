import { PrescriptionService } from './prescription.service';
import { SupabaseDataService } from './supabase-data.service';
import { emptyPrescription } from '../Models/prescription.model';

describe('Prescription database records', () => {
  let service: PrescriptionService;
  let db: jasmine.SpyObj<SupabaseDataService>;
  beforeEach(() => {
    db = jasmine.createSpyObj<SupabaseDataService>('db', ['getItem', 'allocateId', 'upsertRecord', 'setItem', 'deleteRecord', 'deletePrescriptionRecord', 'requireAdministrator']);
    db.requireAdministrator.and.resolveTo(); db.deletePrescriptionRecord.and.resolveTo();
    db.allocateId.and.resolveTo(7);
    db.upsertRecord.and.resolveTo();
    db.setItem.and.resolveTo();
    db.deleteRecord.and.resolveTo();
    service = new PrescriptionService(db);
  });

  it('creates an independent database record using the selected issue date', async () => {
    const draft = emptyPrescription();
    draft.patient.name = '  Ali Khan  ';
    draft.issuedAt = '2020-01-01T00:00:00Z';
    const saved = await service.save(draft);
    expect(saved.id).toBe('7');
    expect(saved.patient.name).toBe('Ali Khan');
    expect(saved.issuedAt).toBe(draft.issuedAt);
    expect(db.upsertRecord).toHaveBeenCalledWith('prescriptions', '7', saved);
    expect(db.setItem).not.toHaveBeenCalled();
    expect(draft.id).toBe('');
    expect(saved.status).toBe('completed');
  });

  it('links each prescription to an OPD visit and reuses the same record instead of duplicating it', async () => {
    const existing = { ...emptyPrescription(), id: '24', opdVisitId: 'opd-visit-a', status: 'draft' as const };
    existing.patient.name = 'Ali Khan';
    db.getItem.and.callFake((key: string) => Promise.resolve(key === 'prescriptions' ? [existing] : null as any));
    const lookup = await service.getByOpdVisitId('opd-visit-a');
    expect(lookup?.id).toBe('24');
    const draft = { ...emptyPrescription(), opdVisitId: 'opd-visit-a' }; draft.patient.name = 'Updated Ali'; draft.status = 'completed';
    const saved = await service.save(draft);
    expect(saved.id).toBe('24'); expect(saved.opdVisitId).toBe('opd-visit-a'); expect(saved.status).toBe('completed');
    expect(db.upsertRecord.calls.mostRecent().args[1]).toBe('24'); expect(db.allocateId).not.toHaveBeenCalled();
  });

  it('saves draft status explicitly', async () => {
    const draft = { ...emptyPrescription(), status: 'draft' as const }; draft.patient.name = 'Ali';
    expect((await service.save(draft)).status).toBe('draft');
  });

  it('keeps undated prescriptions undated instead of substituting the save time', async () => {
    const draft = emptyPrescription(); draft.patient.name = 'Ali';
    expect(draft.issuedAt).toBe(''); const saved = await service.save(draft); expect(saved.issuedAt).toBe('');
    expect(saved.updatedAt).not.toBe('');
    db.getItem.and.callFake((key: string) => Promise.resolve(key === 'prescriptions' ? [saved] : null as any));
    expect((await service.getById(saved.id))!.issuedAt).toBe('');
  });

  it('updates the same record while preserving its original issue and creation dates', async () => {
    const draft = { ...emptyPrescription(), id: '12', issuedAt: '2026-10-01T08:15:00Z', createdAt: '2026-10-01T08:15:00Z' };
    db.getItem.and.callFake((key: string) => Promise.resolve(key === 'prescriptions' ? [draft] : null as any));
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
    db.getItem.and.callFake((key: string) => Promise.resolve(key === 'prescriptions' ? [{ ...emptyPrescription(), id: '8' }] : { patient: { name: 'Legacy' } } as any));
    await service.delete('8');
    await service.delete('legacy-prescription');
    expect(db.deletePrescriptionRecord.calls.allArgs()).toEqual([['prescriptions', '8'], ['prescription', '__singleton__']]);
  });

  it('rejects a blank patient name without touching the database', async () => {
    await expectAsync(service.save(emptyPrescription())).toBeRejectedWithError('Enter the patient name before saving.');
    expect(db.allocateId).not.toHaveBeenCalled();
    expect(db.upsertRecord).not.toHaveBeenCalled();
  });
});
