import { ProcedureService, DEFAULT_PROCEDURES } from './procedure.service';
import { memoryDb } from '../testing/memory-db';
import { ProcedureSelectComponent } from '../Components/procedures/procedure-select.component';

describe('Shared procedure catalog', () => {
  it('starts with the fourteen supplied procedures', async () => {
    const { db } = memoryDb();
    const records = await new ProcedureService(db).getAll();
    expect(records.length).toBe(14);
    expect(records.map(record => record.name)).toEqual(DEFAULT_PROCEDURES.map(record => record.name));
    expect(db.upsertRecord).not.toHaveBeenCalled();
  });

  it('supports add, edit and persistent deletion without reseeding a deleted default', async () => {
    const { db } = memoryDb();
    const service = new ProcedureService(db);
    const added = await service.save('Custom operation');
    expect((await service.getAll()).some(record => record.name === 'Custom operation')).toBeTrue();
    await service.save('Updated operation', added.id);
    expect((await service.getAll()).find(record => record.id === added.id)!.name).toBe('Updated operation');
    const selected = DEFAULT_PROCEDURES[0];
    await service.delete(selected);
    const reloaded = await new ProcedureService(db).getAll();
    expect(reloaded.some(record => record.id === selected.id)).toBeFalse();
    await service.delete(added);
    expect((await service.getAll()).some(record => record.id === added.id)).toBeFalse();
  });

  it('keeps a historical procedure selected after its option is renamed or removed', async () => {
    const { db } = memoryDb();
    const service = new ProcedureService(db);
    const selector = new ProcedureSelectComponent(service, db);
    selector.writeValue(DEFAULT_PROCEDURES[0].name);
    await selector.load();
    expect(selector.hasSavedValue).toBeFalse();
    await service.delete(DEFAULT_PROCEDURES[0]);
    await selector.load();
    expect(selector.value).toBe(DEFAULT_PROCEDURES[0].name);
    expect(selector.hasSavedValue).toBeTrue();
    selector.ngOnDestroy();
  });

  it('rejects empty or duplicate names', async () => {
    const { db } = memoryDb();
    const service = new ProcedureService(db);
    await expectAsync(service.save('  ')).toBeRejectedWithError('Enter a procedure name.');
    await expectAsync(service.save('left nephrectomy')).toBeRejectedWithError('This procedure already exists.');
    expect(db.upsertRecord).not.toHaveBeenCalled();
  });
});
