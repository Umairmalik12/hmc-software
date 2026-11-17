import { RoomService, DEFAULT_ROOMS } from './room.service';
import { RoomSelectComponent } from '../Components/rooms/room-select.component';
import { memoryDb } from '../testing/memory-db';

describe('Managed room and bed options', () => {
  it('provides the initial rooms and beds and persists add, rename and removal across reloads', async () => {
    const { db } = memoryDb(); const service = new RoomService(db);
    expect((await service.getAll()).map(option => option.name)).toEqual(['Room 1', 'Room 2', 'GW Bed 1', 'GW Bed 2']);
    const added = await service.save('  GW   Bed 3  '); expect(added.name).toBe('GW Bed 3');
    const edited = await service.save('Private Room 3', added.id);
    expect((await new RoomService(db).getAll()).find(option => option.id === added.id)!.name).toBe('Private Room 3');
    await service.delete(DEFAULT_ROOMS[0]); await service.delete(edited);
    expect((await new RoomService(db).getAll()).some(option => option.id === DEFAULT_ROOMS[0].id)).toBeFalse();
    expect((await new RoomService(db).getAll()).some(option => option.id === added.id)).toBeFalse();
    const restored = await service.save('Room 1'); expect(restored.id).toBe(DEFAULT_ROOMS[0].id);
    expect(db.setItem).not.toHaveBeenCalled();
  });

  it('rejects duplicates, empty names and stale edits without changing the catalogue', async () => {
    const { db } = memoryDb(); const service = new RoomService(db);
    await expectAsync(service.save('  ')).toBeRejectedWithError('Enter a room or bed name.');
    await expectAsync(service.save('room 1')).toBeRejectedWithError('This room or bed already exists.');
    await expectAsync(service.save('Room 1', DEFAULT_ROOMS[1].id)).toBeRejectedWithError('This room or bed already exists.');
    await expectAsync(service.save('Long'.repeat(30))).toBeRejected();
    await expectAsync(service.save('Room 3', 'missing')).toBeRejectedWithError('This room or bed no longer exists. Refresh the list.');
    expect(db.upsertRecord).not.toHaveBeenCalled();
  });

  it('keeps historical selections on rename/delete and propagates changes without altering the selected label', async () => {
    const { db, collections } = memoryDb(); const service = new RoomService(db);
    const historical = { medicineId: 1, roomNo: 'Room 1', patientName: 'Ali', medicines: [] };
    collections.set('medicineDetails', new Map([['1', historical]]));
    const selector = new RoomSelectComponent(service, db); selector.writeValue('Room 1'); selector.ngOnInit();
    await selector.load(); expect(selector.retainedValues).toEqual([]);
    await service.save('Private Room A', DEFAULT_ROOMS[0].id); await selector.load();
    expect(selector.value).toBe('Room 1'); expect(selector.retainedValues).toEqual(['Room 1']);
    await service.delete(DEFAULT_ROOMS[1]); await selector.load();
    expect(selector.options.some(option => option.name === 'Room 2')).toBeFalse();
    selector.savedValues = ['Old Ward Bed 1', 'Room 1', 'Old Ward Bed 1'];
    expect(selector.retainedValues).toEqual(['Room 1', 'Old Ward Bed 1']);
    expect(collections.get('medicineDetails')!.get('1')).toEqual(historical);
    const changed = jasmine.createSpy('changed'), touched = jasmine.createSpy('touched');
    selector.registerOnChange(changed); selector.registerOnTouched(touched); selector.choose('GW Bed 1');
    expect(changed).toHaveBeenCalledWith('GW Bed 1'); expect(touched).toHaveBeenCalled();
    selector.ngOnDestroy();
  });
});
