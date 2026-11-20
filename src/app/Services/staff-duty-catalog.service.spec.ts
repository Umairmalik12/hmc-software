import { StaffDutyCatalogService, STAFF_DUTY_CATALOG, DEFAULT_STAFF_DUTIES } from './staff-duty-catalog.service';
import { memoryDb } from '../testing/memory-db';
import { legacyRpcDb } from '../testing/legacy-rpc-db';

describe('Staff duty catalogue persistence and historical assignments', () => {
  for (const [backend, create] of [['memory', memoryDb], ['legacy RPC', legacyRpcDb]] as const) {
    it('adds, edits, removes and restores duties through ' + backend + ' without changing staff records', async () => {
      const { db, collections } = create(), catalog = new StaffDutyCatalogService(db);
      const staff = { id: '12', name: 'Ali', active: true, assignments: [{ duty: 'Custom old duty', shift: 'Night', startTime: '20:00', endTime: '08:00' }] };
      collections.set('staffDetails', new Map([['12', staff]])); collections.set('payments', new Map([['7', { id: '7', amount: 100, staffName: 'Ali' }]]));
      const legacy = (await catalog.getAll()).find(option => option.name === 'Custom old duty')!;
      expect(legacy.id).toContain('legacy:'); expect((await catalog.getAll()).length).toBe(DEFAULT_STAFF_DUTIES.length + 1);
      const renamed = await catalog.save('Updated duty', legacy.id);
      expect(renamed.id).toBe(legacy.id); expect(renamed.previousNames).toContain('Custom old duty');
      const fresh = new StaffDutyCatalogService(db); expect((await fresh.getAll()).some(option => option.name === 'Custom old duty')).toBeFalse();
      expect((await fresh.getAll()).some(option => option.name === 'Updated duty')).toBeTrue();
      await fresh.setActive(renamed.id, false); expect((await new StaffDutyCatalogService(db).getAll()).some(option => option.id === renamed.id)).toBeFalse();
      await fresh.setActive(renamed.id, true); expect((await fresh.getAll()).find(option => option.id === renamed.id)!.active).toBeTrue();
      const added = await fresh.save('  Cleaning   supervisor  '); expect(added.name).toBe('Cleaning supervisor');
      await fresh.setActive(added.id, false); const restored = await fresh.save('Cleaning supervisor'); expect(restored.id).toBe(added.id);
      expect(collections.get('staffDetails')!.get('12')).toEqual(staff); expect(collections.get('payments')!.get('7')).toEqual({ id: '7', amount: 100, staffName: 'Ali' });
      expect([...collections.get(STAFF_DUTY_CATALOG)!.values()].filter(option => option.name === 'Cleaning supervisor').length).toBe(1);
    });
  }
  it('keeps removed defaults removed, imports each custom name once and never writes while loading', async () => {
    const { db, collections } = memoryDb(); const catalog = new StaffDutyCatalogService(db);
    collections.set('staffDetails', new Map([['1', { id: '1', assignments: [{ duty: 'Ward round' }, { duty: ' ward   ROUND ' }, { duty: 'OT in-charge' }] }]]));
    const all = await catalog.getAll(); expect(all.filter(option => option.name === 'Ward round').length).toBe(1);
    expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled(); expect(db.allocateId).not.toHaveBeenCalled();
    const preset = all.find(option => option.name === 'OT in-charge')!; await catalog.setActive(preset.id, false);
    expect((await new StaffDutyCatalogService(db).getAll()).some(option => option.name === 'OT in-charge')).toBeFalse();
    expect((await catalog.getAll(true)).find(option => option.id === preset.id)!.active).toBeFalse();
  });
  it('rejects invalid, duplicate and missing-ID updates before allocating or writing records', async () => {
    const { db } = memoryDb(), catalog = new StaffDutyCatalogService(db);
    for (const name of ['', '  ', 'X'.repeat(121), 'ot  IN-CHARGE']) await expectAsync(catalog.save(name)).toBeRejected();
    await expectAsync(catalog.save('Example', 'missing')).toBeRejectedWithError(/no longer exists/);
    await expectAsync(catalog.setActive('missing', false)).toBeRejectedWithError(/no longer exists/);
    expect(db.allocateId).not.toHaveBeenCalled(); expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled();
  });
  it('retains a renamed custom duty alias so it cannot reappear from existing staff assignments after removal', async () => {
    const { db, collections } = memoryDb(), catalog = new StaffDutyCatalogService(db); const first = await catalog.save('Custom duty');
    collections.set('staffDetails', new Map([['1', { id: '1', assignments: [{ duty: 'Custom duty' }] }]]));
    await catalog.save('Custom duty renamed', first.id); await catalog.setActive(first.id, false);
    const all = await new StaffDutyCatalogService(db).getAll(true); expect(all.filter(option => option.name.startsWith('Custom duty')).length).toBe(1);
    expect(all.find(option => option.id === first.id)!.previousNames).toContain('Custom duty');
    expect((await catalog.getAll()).some(option => option.name === 'Custom duty')).toBeFalse();
  });
  it('reports a failed write without changing stored duty names or activity', async () => {
    const { db, collections } = memoryDb(), catalog = new StaffDutyCatalogService(db); const duty = await catalog.save('Original duty');
    (db.upsertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    await expectAsync(catalog.save('Unsaved duty', duty.id)).toBeRejectedWithError('Offline');
    expect(collections.get(STAFF_DUTY_CATALOG)!.get(duty.id).name).toBe('Original duty');
  });
});
