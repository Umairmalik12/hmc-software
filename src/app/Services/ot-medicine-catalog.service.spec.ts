import { emptyOtCatalogMedicine } from '../Models/ot-medicine-catalog.model';
import { emptyOtRecord } from '../Models/ot-medicine.model';
import { memoryDb } from '../testing/memory-db';
import { DEFAULT_OT_CATALOG, OT_MEDICINE_CATALOG, OtMedicineCatalogService } from './ot-medicine-catalog.service';

describe('OT medicine master database persistence', () => {
  it('supports the same medicine in different strengths and scopes duplicate, edit, delete and restore to one strength', async () => {
    const { db, collections } = memoryDb(); const catalog = new OtMedicineCatalogService(db);
    try {
      const one = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '1g' });
      const two = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '2g' });
      expect(one.id).not.toBe(two.id);
      const historical = { ...emptyOtRecord(), id: 'p', products: [{ name: '2SUM', strength: '1g', catalogueId: one.id, quantity: 2 }] };
      collections.set('otFormData', new Map([['p', historical]]));
      await expectAsync(catalog.save({ ...emptyOtCatalogMedicine(), name: '2sum 1 g' })).toBeRejectedWithError(/already exists/);
      await expectAsync(catalog.save({ ...one, strength: '2 g' })).toBeRejectedWithError(/already exists/);
      const changed = await catalog.save({ ...two, strength: '500mg' }); expect(changed.id).toBe(two.id); expect((await catalog.getById(one.id))!.strength).toBe('1g');
      await catalog.delete(two.id); const restored = await catalog.save({ ...emptyOtCatalogMedicine(), name: '2SUM', strength: '500 mg' });
      expect(restored.id).toBe(two.id); expect((await catalog.getAll()).filter(item => item.name === '2SUM').length).toBe(2); expect(collections.get('otFormData')!.get('p')).toEqual(historical);
    } finally { catalog.ngOnDestroy(); }
  });
  it('keeps the original supplies and persists optional medicine details across service reloads', async () => {
    const { db } = memoryDb(); const catalog = new OtMedicineCatalogService(db);
    try {
      expect((await catalog.getAll()).map(item => item.name)).toEqual(DEFAULT_OT_CATALOG.map(item => item.name));
      const saved = await catalog.save({ ...emptyOtCatalogMedicine(), name: '  Test medicine  ', genericName: 'Generic A', category: 'Anaesthesia', type: 'Injection', strength: '10mg/ml', unit: 'Vial', description: 'Store as labelled' });
      const reloaded = new OtMedicineCatalogService(db);
      try {
        expect(await reloaded.getById(saved.id)).toEqual(saved);
        expect(saved.name).toBe('Test medicine'); expect(saved.active).toBeTrue();
        expect(saved.createdAt).toBeTruthy(); expect(db.setItem).not.toHaveBeenCalled();
      } finally { reloaded.ngOnDestroy(); }
    } finally { catalog.ngOnDestroy(); }
  });

  it('edits an existing item without duplicating it and safely deactivates or removes it without changing historical OT records', async () => {
    const { db, collections } = memoryDb(); const catalog = new OtMedicineCatalogService(db);
    try {
      const item = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Test item', strength: '500mg' });
      const historical = { ...emptyOtRecord(), id: '7', patientName: 'Ali', products: [{ name: item.name, catalogueId: item.id, strength: '500mg', quantity: 2, amount: 150 }] };
      collections.set('otFormData', new Map([['7', historical]]));
      const edited = await catalog.save({ ...item, name: 'Renamed item', strength: '1g', active: false });
      expect(edited.id).toBe(item.id); expect(edited.createdAt).toBe(item.createdAt);
      expect((await catalog.getAll()).filter(row => row.id === item.id).length).toBe(1);
      expect((await catalog.getById(item.id))!.active).toBeFalse();
      await catalog.delete(item.id);
      expect(await catalog.getById(item.id)).toBeUndefined();
      expect(collections.get(OT_MEDICINE_CATALOG)!.get(item.id).deleted).toBeTrue();
      expect(collections.get('otFormData')!.get('7')).toEqual(historical);
      expect(db.deleteRecord).not.toHaveBeenCalled();
    } finally { catalog.ngOnDestroy(); }
  });

  it('does not resurrect removed starter medicines on reload and explicitly restores a re-added name', async () => {
    const { db } = memoryDb(); const catalog = new OtMedicineCatalogService(db);
    const starter = DEFAULT_OT_CATALOG[0];
    try {
      await catalog.delete(starter.id);
      expect((await catalog.getAll(false, true)).some(item => item.id === starter.id)).toBeFalse();
      const restored = await catalog.save({ ...emptyOtCatalogMedicine(), name: starter.name });
      expect(restored.id).toBe(starter.id); expect(restored.deleted).toBeFalse();
      expect((await catalog.getAll()).filter(item => item.id === starter.id).length).toBe(1);
    } finally { catalog.ngOnDestroy(); }
  });

  it('rejects blank and duplicate names, including inactive entries, before writing', async () => {
    const { db } = memoryDb(); const catalog = new OtMedicineCatalogService(db);
    try {
      await expectAsync(catalog.save({ ...emptyOtCatalogMedicine(), name: '   ' })).toBeRejectedWithError('Enter the medicine name.');
      const item = await catalog.save({ ...emptyOtCatalogMedicine(), name: 'Test duplicate', active: false });
      (db.upsertRecord as jasmine.Spy).calls.reset();
      await expectAsync(catalog.save({ ...emptyOtCatalogMedicine(), name: ' test   DUPLICATE ' })).toBeRejectedWithError(/already exists/);
      expect(db.upsertRecord).not.toHaveBeenCalled();
      expect((await catalog.save({ ...item, active: true })).id).toBe(item.id);
    } finally { catalog.ngOnDestroy(); }
  });
});
