import { ClinicalCatalogKind, ClinicalCatalogService, DEFAULT_LAB_TESTS } from './clinical-catalog.service';
import { memoryDb } from '../testing/memory-db';
import { legacyRpcDb } from '../testing/legacy-rpc-db';

describe('Shared doctor/surgeon and lab-test catalogue persistence', () => {
  for (const kind of ['doctors', 'lab-tests'] as ClinicalCatalogKind[]) {
    for (const [backend, create] of [['memory', memoryDb], ['legacy RPC', legacyRpcDb]] as const) {
      it(`creates, reads, edits, soft deletes and restores ${kind} via ${backend} without changing patient records`, async () => {
        const { db, collections } = create(); const catalog = new ClinicalCatalogService(db);
        if (!jasmine.isSpy(db.setItem)) spyOn(db, 'setItem').and.callThrough();
        const patient = { patientId: 8123, drName: 'Original doctor', surgeonName: 'Original doctor', testName: 'Original test' };
        collections.set('patientDetails', new Map([['8123', patient]]));
        const created = await catalog.save(kind, '  New   name  ');
        expect(created.name).toBe('New name'); expect(created.active).toBeTrue();
        expect((await catalog.getAll(kind)).some(option => option.id === created.id)).toBeTrue();
        const updated = await catalog.save(kind, 'Updated name', created.id);
        expect(updated.id).toBe(created.id);
        await catalog.delete(kind, updated);
        expect((await catalog.getAll(kind)).some(option => option.id === created.id)).toBeFalse();
        expect((await catalog.getAll(kind, true)).find(option => option.id === created.id)!.active).toBeFalse();
        const restored = await catalog.save(kind, 'updated name'); expect(restored.id).toBe(created.id);
        expect(collections.get('patientDetails')!.get('8123')).toEqual(patient);
        expect(db.setItem).not.toHaveBeenCalled();
      });
    }

    it(`rejects empty, duplicate and missing ${kind} records before saving`, async () => {
      const { db } = memoryDb(); const catalog = new ClinicalCatalogService(db);
      await expectAsync(catalog.save(kind, '   ')).toBeRejectedWithError(/Enter/);
      await expectAsync(catalog.save(kind, 'X'.repeat(121))).toBeRejectedWithError(/120/);
      await catalog.save(kind, 'New name');
      await expectAsync(catalog.save(kind, ' new   NAME ')).toBeRejectedWithError(/already exists/);
      await expectAsync(catalog.save(kind, 'Missing', 'nonexistent')).toBeRejectedWithError(/no longer exists/);
    });
  }

  it('starts with existing lab tests and keeps renamed and deleted defaults across reloads', async () => {
    const { db } = memoryDb(); const catalog = new ClinicalCatalogService(db);
    expect((await catalog.getAll('lab-tests')).length).toBe(15);
    const cbc = DEFAULT_LAB_TESTS.find(option => option.name === 'CBC')!;
    await catalog.save('lab-tests', 'Complete blood count', cbc.id);
    await catalog.delete('lab-tests', DEFAULT_LAB_TESTS[0]);
    const reloaded = await new ClinicalCatalogService(db).getAll('lab-tests');
    expect(reloaded.some(option => option.name === 'Complete blood count')).toBeTrue();
    expect(reloaded.some(option => option.name === 'CBC' || option.name === 'RPM')).toBeFalse();
    await expectAsync(catalog.save('lab-tests', 'CBC, LFTs')).toBeRejectedWithError(/one lab test/);
  });

  it('surfaces database errors and does not report failed writes as successful changes', async () => {
    const { db } = memoryDb(); const catalog = new ClinicalCatalogService(db); const changed = jasmine.createSpy('changed');
    catalog.changes.subscribe(changed);
    (db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    await expectAsync(catalog.save('doctors', 'Dr Ali')).toBeRejectedWithError('Offline'); expect(changed).not.toHaveBeenCalled();
  });
});
