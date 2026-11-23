import { memoryDb } from '../testing/memory-db';
import { emptyPrescription } from '../Models/prescription.model';
import { PrescriptionService } from './prescription.service';

describe('Prescription storage identity and admin mutations', () => {
  it('edits and deletes the actual saved row even if its payload contains an outdated ID', async () => {
    const store = memoryDb(), service = new PrescriptionService(store.db);
    const row = { ...emptyPrescription(), id: 'outdated' }; row.patient.name = 'Ali';
    store.collections.set('prescriptions', new Map([['42', row], ['43', { ...row, id: '43' }]]));
    const editing = (await service.getById('42'))!; expect(editing.id).toBe('42'); editing.patient.name = 'Updated Ali';
    await service.save(editing); expect(store.collections.get('prescriptions')!.size).toBe(2); expect(store.collections.get('prescriptions')!.get('42').patient.name).toBe('Updated Ali');
    await service.delete('42'); expect(store.collections.get('prescriptions')!.has('42')).toBeFalse(); expect(store.collections.get('prescriptions')!.has('43')).toBeTrue();
  });
  it('keeps a legacy singleton and a normal prescription with the legacy display ID independently editable and deletable', async () => {
    const store = memoryDb(), service = new PrescriptionService(store.db), normal = { ...emptyPrescription(), id: 'legacy-prescription' };
    normal.patient.name = 'Normal'; const legacy = emptyPrescription(); legacy.patient.name = 'Legacy';
    store.collections.set('prescriptions', new Map([[normal.id, normal]])); store.collections.set('prescription', new Map([['__singleton__', legacy]]));
    const rows = await service.getAll(); expect(rows.length).toBe(2); expect(new Set(rows.map(row => row.id)).size).toBe(2);
    const old = rows.find(row => row.patient.name === 'Legacy')!; old.patient.name = 'Updated legacy'; await service.save(old);
    const current = rows.find(row => row.patient.name === 'Normal')!; current.patient.name = 'Updated normal'; await service.save(current);
    expect(store.collections.get('prescription')!.get('__singleton__').patient.name).toBe('Updated legacy');
    expect(store.collections.get('prescriptions')!.get(normal.id).patient.name).toBe('Updated normal');
    await service.delete(old.id); expect((await service.getAll()).length).toBe(1);
    await service.delete(normal.id); expect((await service.getAll()).length).toBe(0);
  });
  it('blocks revoked accounts and never recreates a prescription removed while its edit form was open', async () => {
    const store = memoryDb(), service = new PrescriptionService(store.db), row = emptyPrescription(); row.patient.name = 'Ali';
    const saved = await service.save(row); const editing = (await service.getById(saved.id))!;
    (store.db.requireAdministrator as jasmine.Spy).and.rejectWith(new Error('Admin required'));
    await expectAsync(service.save(editing)).toBeRejectedWithError('Admin required'); await expectAsync(service.delete(saved.id)).toBeRejectedWithError('Admin required');
    expect(store.collections.get('prescriptions')!.size).toBe(1);
    (store.db.requireAdministrator as jasmine.Spy).and.resolveTo(); await service.delete(saved.id);
    await expectAsync(service.save(editing)).toBeRejectedWithError(/no longer exists/); expect(store.collections.get('prescriptions')!.size).toBe(0);
  });
});
