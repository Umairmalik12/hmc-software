import { memoryDb } from '../testing/memory-db';
import { PrescriptionMedicineCatalogService, PRESCRIPTION_MEDICINE_CATALOG } from './prescription-medicine-catalog.service';
import { OtMedicineCatalogService, OT_MEDICINE_CATALOG } from './ot-medicine-catalog.service';
import { emptyOtCatalogMedicine } from '../Models/ot-medicine-catalog.model';

describe('Medicine catalogue permissions', () => {
  for (const kind of ['main', 'ot'] as const) {
    it('allows staff creation but requires fresh admin authorization for edits, deletion and restoration in ' + kind, async () => {
      const store = memoryDb(), guard = store.db.requireAdministrator as jasmine.Spy;
      const main = new PrescriptionMedicineCatalogService(store.db), ot = new OtMedicineCatalogService(store.db);
      const service = kind === 'main' ? main : ot, collection = kind === 'main' ? PRESCRIPTION_MEDICINE_CATALOG : OT_MEDICINE_CATALOG;
      const save = (id = '') => kind === 'main' ? main.save('Permission sample', id || undefined, '1g') : ot.save({ ...emptyOtCatalogMedicine(), id, name: 'Permission sample', strength: '1g' });
      const remove = (row: any) => kind === 'main' ? main.delete(row) : ot.delete(row.id);
      try {
        guard.and.rejectWith(new Error('Admin required')); expect(await service.canManage()).toBeFalse();
        const created = await save(); expect(created.id).toBeTruthy(); expect((await service.getAll()).some(row => row.id === created.id)).toBeTrue();
        const before = JSON.stringify([...store.collections.get(collection)!.values()]);
        await expectAsync(save(created.id)).toBeRejectedWithError('Admin required'); await expectAsync(remove(created)).toBeRejectedWithError('Admin required');
        expect(JSON.stringify([...store.collections.get(collection)!.values()])).toBe(before);
        guard.and.resolveTo(); expect(await service.canManage()).toBeTrue(); await save(created.id); await remove(created);
        const removed = JSON.stringify([...store.collections.get(collection)!.values()]);
        guard.and.rejectWith(new Error('Role revoked')); await expectAsync(save()).toBeRejectedWithError('Role revoked');
        expect(JSON.stringify([...store.collections.get(collection)!.values()])).toBe(removed);
        guard.and.resolveTo(); expect((await save()).id).toBe(created.id);
      } finally { main.ngOnDestroy(); ot.ngOnDestroy(); }
    });
  }
});
