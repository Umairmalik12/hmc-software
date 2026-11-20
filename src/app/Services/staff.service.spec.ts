import { StaffDraft, StaffDutyAssignment, dutyTimingError, formatDutyTiming } from '../Models/staff.model';
import { StaffService, STAFF_COLLECTION } from './staff.service';
import { memoryDb } from '../testing/memory-db';
import { legacyRpcDb } from '../testing/legacy-rpc-db';

const assignment = (overrides: Partial<StaffDutyAssignment> = {}): StaffDutyAssignment => ({ duty: 'OT in-charge', shift: 'Night', startTime: '22:00', endTime: '06:00', ...overrides });
const draft = (overrides: Partial<StaffDraft> = {}): StaffDraft => ({ name: 'Ali', designation: 'OT assistant', employmentType: 'permanent', active: true, assignments: [assignment()], ...overrides });

describe('Staff CRUD persistence and duty timings', () => {
  for (const [backend, create] of [['memory', memoryDb], ['legacy RPC', legacyRpcDb]] as const) {
    it('adds, reads, edits, deactivates and restores staff with multiple duties via ' + backend, async () => {
      const { db, collections } = create(); const service = new StaffService(db);
      const oldStaff = { ...draft(), id: '900', createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' };
      const payment = { id: '77', staffName: 'Ali', shiftName: 'Night', amount: 100 };
      collections.set(STAFF_COLLECTION, new Map([['900', oldStaff]])); collections.set('payments', new Map([['77', payment]]));
      const data = draft({ name: '  Ali   Khan ', assignments: [assignment(), assignment({ duty: 'Patient medicines', shift: 'Evening', startTime: '16:00', endTime: '21:00' })] });
      const created = await service.save(data);
      expect(created.name).toBe('Ali Khan'); expect(created.id).not.toBe('900'); expect(created.assignments.length).toBe(2);
      expect((await new StaffService(db).getById(created.id))!.assignments[0].endTime).toBe('06:00');
      expect(data.name).toBe('  Ali   Khan ');
      const updated = await service.save({ ...created, name: 'Updated staff', employmentType: 'intern' }, created.id);
      expect(updated.createdAt).toBe(created.createdAt); expect(updated.id).toBe(created.id); expect(updated.employmentType).toBe('intern');
      await service.delete(created.id);
      expect((await service.getAll()).some(item => item.id === created.id)).toBeFalse();
      const inactive = (await service.getById(created.id))!; expect(inactive.active).toBeFalse(); expect(inactive.assignments.length).toBe(2);
      await service.save({ ...inactive, active: true }, inactive.id);
      expect((await service.getAll()).some(item => item.id === created.id)).toBeTrue();
      expect(collections.get(STAFF_COLLECTION)!.get('900')).toEqual(oldStaff); expect(collections.get('payments')!.get('77')).toEqual(payment);
    });
  }

  it('allows staff with the same name to have separate identities and accepts optional schedule details', async () => {
    const { db } = memoryDb(); const service = new StaffService(db);
    const first = await service.save(draft({ designation: '', employmentType: '', assignments: [] }));
    const second = await service.save(draft({ designation: '', assignments: [assignment({ shift: '', startTime: '', endTime: '' })] }));
    expect(first.id).not.toBe(second.id); expect((await service.getAll()).length).toBe(2);
    expect(formatDutyTiming(second.assignments[0])).toBe('Timing not recorded');
  });

  it('rejects invalid names, employment status, incomplete or invalid times and duplicate duties before writing', async () => {
    const { db } = memoryDb(); const service = new StaffService(db);
    const invalid: any[] = [
      { name: '  ' }, { name: 'X'.repeat(121) }, { employmentType: 'contract' }, { employmentType: false }, { active: 'yes' },
      { assignments: null }, { assignments: [assignment({ duty: '' })] }, { assignments: [assignment({ startTime: '' })] },
      { assignments: [assignment({ startTime: '25:00' })] }, { assignments: [assignment({ endTime: '22:00' })] },
      { assignments: [assignment(), assignment({ duty: 'ot   IN-CHARGE', shift: ' night ' })] },
    ];
    for (const value of invalid) await expectAsync(service.save(draft(value))).toBeRejected();
    expect(db.allocateId).not.toHaveBeenCalled(); expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled();
  });

  it('does not turn missing edits or deletions into new staff records', async () => {
    const { db } = memoryDb(); const service = new StaffService(db);
    await expectAsync(service.save(draft(), 'missing')).toBeRejectedWithError(/no longer exists/);
    await expectAsync(service.delete('missing')).toBeRejectedWithError(/no longer exists/);
    expect(db.insertRecord).not.toHaveBeenCalled(); expect(db.upsertRecord).not.toHaveBeenCalled();
  });

  it('surfaces failed writes and leaves the draft and stored records intact', async () => {
    const { db, collections } = memoryDb(); const service = new StaffService(db); const data = draft(); const original = JSON.stringify(data);
    (db.insertRecord as jasmine.Spy).and.rejectWith(new Error('Offline'));
    await expectAsync(service.save(data)).toBeRejectedWithError('Offline');
    expect(JSON.stringify(data)).toBe(original); expect(collections.get(STAFF_COLLECTION)?.size || 0).toBe(0);
  });

  it('formats daytime, midnight and overnight schedules without assigning a false date', () => {
    expect(formatDutyTiming(assignment())).toBe('10:00 PM – 6:00 AM (next day)');
    expect(formatDutyTiming(assignment({ startTime: '00:00', endTime: '08:00' }))).toBe('12:00 AM – 8:00 AM');
    expect(formatDutyTiming(assignment({ startTime: '08:30', endTime: '16:30' }))).toBe('8:30 AM – 4:30 PM');
    expect(dutyTimingError('08:00', '')).toContain('both'); expect(dutyTimingError('08:00', '08:00')).toContain('different');
  });
});
