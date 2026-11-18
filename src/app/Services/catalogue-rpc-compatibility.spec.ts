import { emptyOtCatalogMedicine } from '../Models/ot-medicine-catalog.model';
import { legacyRpcDb } from '../testing/legacy-rpc-db';
import { OtMedicineCatalogService, DEFAULT_OT_CATALOG, OT_MEDICINE_CATALOG } from './ot-medicine-catalog.service';
import { PrescriptionMedicineCatalogService, DEFAULT_PRESCRIPTION_MEDICINES, PRESCRIPTION_MEDICINE_CATALOG } from './prescription-medicine-catalog.service';
import { ProcedureService, DEFAULT_PROCEDURES } from './procedure.service';
import { RoomService, DEFAULT_ROOMS } from './room.service';

describe('Catalogue saves against older deployed CRUD functions', () => {
  for (const catalog of ['prescription', 'OT', 'procedures', 'rooms'] as const) {
    it(`adds, edits, reads and removes ${catalog} entries using the real database request path`, async () => {
      const { db, collections, rpc } = legacyRpcDb();
      const prescription = new PrescriptionMedicineCatalogService(db); const ot = new OtMedicineCatalogService(db);
      const service = catalog === 'prescription' ? prescription : catalog === 'OT' ? ot : catalog === 'procedures' ? new ProcedureService(db) : new RoomService(db);
      const collection = catalog === 'prescription' ? PRESCRIPTION_MEDICINE_CATALOG : catalog === 'OT' ? OT_MEDICINE_CATALOG : catalog;
      const defaultItem = catalog === 'prescription' ? DEFAULT_PRESCRIPTION_MEDICINES[0] : catalog === 'OT' ? DEFAULT_OT_CATALOG[0] : catalog === 'procedures' ? DEFAULT_PROCEDURES[0] : DEFAULT_ROOMS[0];
      const save = (name: string, id?: string) => catalog === 'OT' ? ot.save({ ...emptyOtCatalogMedicine(), name, id: id || '' }) : (service as PrescriptionMedicineCatalogService).save(name, id);
      const remove = async (id: string, name: string) => catalog === 'OT' ? ot.delete(id) : (service as PrescriptionMedicineCatalogService).delete({ id, name, active: true });
      try {
        // A default can be shown by the app before it has a physical database row.
        await save('Edited starter entry', defaultItem.id);
        expect(collections.get(collection)!.get(defaultItem.id).name).toBe('Edited starter entry');
        const added = await save('New catalogue entry'); expect(added.id).toBe('5');
        await save('Updated catalogue entry', added.id);
        expect((await service.getAll()).find(row => row.id === added.id)!.name).toBe('Updated catalogue entry');
        expect(collections.get(collection)!.size).toBe(2);
        await remove(added.id, 'Updated catalogue entry');
        expect((await service.getAll()).some(row => row.id === added.id && row.active)).toBeFalse();
        expect(collections.get(collection)!.get(added.id).active).toBeFalse();
        if (catalog === 'prescription') {
          const strength = await prescription.save('Strength variant', undefined, '500mg');
          await prescription.save('Strength variant', strength.id, '1g');
          expect(collections.get(collection)!.get(strength.id)).toEqual(jasmine.objectContaining({ name: 'Strength variant 1 g', strength: '1 g' }));
        }
        expect(rpc.calls.allArgs().filter(([name]) => name === 'apply_hmc_record_changes').every(([, args]) => args.p_updates.length === 0 && args.p_inserts.length === 1)).toBeTrue();
      } finally { prescription.ngOnDestroy(); ot.ngOnDestroy(); }
    });
  }
});
