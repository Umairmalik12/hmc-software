import { memoryDb } from '../testing/memory-db';
import { DEFAULT_PRESCRIPTION_MEDICINES, medicineKey, PRESCRIPTION_MEDICINE_CATALOG, PrescriptionMedicineCatalogService } from './prescription-medicine-catalog.service';

describe('Prescription medicine catalogue persistence', () => {
  it('retains built-ins and legacy custom suggestions without duplicates or writes on read', async () => {
    const { db, collections } = memoryDb();
    collections.set('customMedicines', new Map([['mixel', '  mixel '], ['custom', 'Custom Medicine'], ['custom-again', ' custom   medicine ']]));
    const service = new PrescriptionMedicineCatalogService(db);
    try {
      const lists = await Promise.all(Array.from({ length: 8 }, () => service.getAll()));
      const rows = lists[0]; expect(rows.length).toBe(DEFAULT_PRESCRIPTION_MEDICINES.length + 1);
      expect(rows.filter(option => medicineKey(option.name) === 'custom medicine').length).toBe(1);
      expect(rows.every(option => option.name === option.name.trim())).toBeTrue();
      expect(db.getItem).toHaveBeenCalledTimes(2); expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.setItem).not.toHaveBeenCalled();
      rows[0].name = 'Changed local snapshot'; expect((await service.getAll())[0].name).not.toBe('Changed local snapshot');
    } finally { service.ngOnDestroy(); }
  });

  it('supports add, edit, delete and restore across reloads while preserving saved prescriptions and legacy data', async () => {
    const { db, collections } = memoryDb();
    collections.set('customMedicines', new Map([['custom', 'Legacy Medicine']]));
    const prescription = { id: '1', medicines: [{ name: 'MIXEL', morning: true }] };
    collections.set('prescriptions', new Map([['1', prescription]]));
    const service = new PrescriptionMedicineCatalogService(db);
    try {
      const custom = await service.save('  New   Medicine 250mg  '); expect(custom.name).toBe('New Medicine 250mg');
      await service.save('Edited Medicine', custom.id);
      const builtIn = (await service.getAll()).find(option => option.name === 'MIXEL')!;
      const legacy = (await service.getAll()).find(option => option.name === 'Legacy Medicine')!;
      await service.save('MIXEL UPDATED', builtIn.id); await service.delete(legacy); await service.delete({ ...custom, name: 'Edited Medicine' });
      const other = new PrescriptionMedicineCatalogService(db);
      try {
        const reloaded = await other.getAll();
        expect(reloaded.some(option => option.name === 'MIXEL')).toBeFalse(); expect(reloaded.some(option => option.name === 'MIXEL UPDATED')).toBeTrue();
        expect(reloaded.some(option => option.name === 'Legacy Medicine')).toBeFalse(); expect(reloaded.some(option => option.id === custom.id)).toBeFalse();
        const restored = await other.save('Legacy Medicine'); expect(restored.id).toBe(legacy.id);
      } finally { other.ngOnDestroy(); }
      expect(collections.get('prescriptions')!.get('1')).toEqual(prescription); expect(collections.get('customMedicines')!.get('custom')).toBe('Legacy Medicine');
      expect(db.setItem).not.toHaveBeenCalled();
    } finally { service.ngOnDestroy(); }
  });

  it('rejects empty, overlong, duplicate and missing-ID edits without replacing the catalogue', async () => {
    const { db } = memoryDb(); const service = new PrescriptionMedicineCatalogService(db);
    try {
      await expectAsync(service.save('  ')).toBeRejectedWithError('Enter a medicine name.');
      await expectAsync(service.save('a'.repeat(161))).toBeRejected();
      await expectAsync(service.save(' mixel ')).toBeRejectedWithError('This medicine already exists.');
      await expectAsync(service.save('Medicine', 'missing')).toBeRejectedWithError('This medicine no longer exists. Refresh the list.');
      expect(db.upsertRecord).not.toHaveBeenCalled();
    } finally { service.ngOnDestroy(); }
  });

  it('retries failed reads and invalidates cached suggestions after a remote catalogue change', async () => {
    const { db, collections } = memoryDb(); const service = new PrescriptionMedicineCatalogService(db);
    try {
      (db.getItem as jasmine.Spy).and.rejectWith(new Error('offline'));
      await expectAsync(service.getAll()).toBeRejectedWithError('offline');
      (db.getItem as jasmine.Spy).and.callFake(async (collection: string) => Array.from(collections.get(collection)?.values() || []));
      await service.getAll();
      collections.set(PRESCRIPTION_MEDICINE_CATALOG, new Map([['new', { id: 'new', name: 'Remote Medicine', active: true }]]));
      db.changes.next(PRESCRIPTION_MEDICINE_CATALOG);
      expect((await service.getAll()).some(option => option.name === 'Remote Medicine')).toBeTrue();
    } finally { service.ngOnDestroy(); }
  });
});
