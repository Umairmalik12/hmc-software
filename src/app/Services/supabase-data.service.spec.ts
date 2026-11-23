import { SupabaseClientService } from './supabase-client.service';
import { SupabaseDataService } from './supabase-data.service';

describe('SupabaseDataService', () => {
  let service: SupabaseDataService;
  let client: any;
  let query: any;
  let channel: any;

  beforeEach(() => {
    channel = {
      on: jasmine.createSpy('on').and.callFake(() => channel),
      subscribe: jasmine.createSpy('subscribe'),
    };
    query = {
      insert: jasmine.createSpy('insert').and.resolveTo({ error: null }),
      select: jasmine.createSpy('select').and.callFake(() => query),
      eq: jasmine.createSpy('eq').and.callFake(() => query),
      order: jasmine.createSpy('order').and.callFake(() => query),
      range: jasmine.createSpy('range').and.returnValue(Promise.resolve({ data: [], error: null })),
      upsert: jasmine.createSpy('upsert').and.returnValue(Promise.resolve({ error: null })),
      update: jasmine.createSpy('update').and.callFake(() => query),
      single: jasmine.createSpy('single'),
      delete: jasmine.createSpy('delete').and.callFake(() => query),
    };
    client = {
      from: jasmine.createSpy('from').and.returnValue(query),
      rpc: jasmine.createSpy('rpc').and.returnValue(Promise.resolve({ data: null, error: null })),
      channel: jasmine.createSpy('channel').and.returnValue(channel),
    };
    service = new SupabaseDataService({ client } as SupabaseClientService);
  });

  it('creates new remote rows using stable collection IDs', async () => {
    await service.getItem<any[]>('patientDetails');
    const record = { patientId: 7, firstName: 'Ali' };

    await service.setItem('patientDetails', [record]);

    expect(client.rpc).toHaveBeenCalledWith('apply_hmc_record_changes', {
      p_collection: 'patientDetails',
      p_inserts: [{ record_id: '7', data: record, sort_order: 0 }],
      p_updates: [],
      p_delete_ids: [],
    });
  });

  it('inserts manual-MR registrations without an upsert or ID allocation RPC', async () => {
    const record = { patientId: 8123, firstName: 'Ali' };
    await service.insertRecord('patientDetails', 8123, record);
    expect(query.insert).toHaveBeenCalledWith({ collection: 'patientDetails', record_id: '8123', data: record, sort_order: 0 });
    expect(client.rpc).not.toHaveBeenCalled();
    query.insert.and.resolveTo({ error: { message: 'Duplicate MR' } });
    await expectAsync(service.insertRecord('patientDetails', 8123, record)).toBeRejectedWithError('Duplicate MR');
  });

  it('blocks automatic operation/OPD MR and inpatient patient ID allocation while keeping other modules supported', async () => {
    await expectAsync(service.allocateId('patientDetails')).toBeRejectedWithError(/Enter the patient MR number/);
    await expectAsync(service.allocateId('opdDetails')).toBeRejectedWithError(/Enter the patient MR number/);
    await expectAsync(service.allocateId('inpatientDetails')).toBeRejectedWithError(/Enter the patient ID/);
    expect(client.rpc).not.toHaveBeenCalled();
    client.rpc.and.resolveTo({ data: 7, error: null });
    expect(await service.allocateId('labDetails')).toBe(7);
  });

  it('updates only a token patient name and returns its unchanged queue identity', async () => {
    client.rpc.and.resolveTo({ data: true, error: null });
    query.single.and.resolveTo({ data: { id: 7, token_number: 'A003', sequence: 3, customer_name: 'Ali Khan', token_date: '2026-11-17', token_time: '01:35 PM', created_at: '2026-11-17T08:35:00Z' }, error: null });
    const saved = await service.updatePatientTokenName(7, ' Ali Khan ');
    expect(query.update).toHaveBeenCalledWith({ customer_name: 'Ali Khan' });
    expect(saved.tokenNumber).toBe('A003');
    expect(saved.sequence).toBe(3);
    expect(saved.customerName).toBe('Ali Khan');
    expect(client.rpc).toHaveBeenCalledWith('hmc_is_admin');
  });

  it('denies token updates and deletion for staff, missing roles and failed permission checks before issuing writes', async () => {
    for (const data of [false, null, 'true']) {
      client.rpc.and.resolveTo({ data, error: null });
      await expectAsync(service.updatePatientTokenName(7, 'Name')).toBeRejectedWithError(/Only administrators/);
      await expectAsync(service.deletePatientToken(7)).toBeRejectedWithError(/Only administrators/);
    }
    client.rpc.and.resolveTo({ data: null, error: { message: 'Role check failed' } });
    await expectAsync(service.updatePatientTokenName(7, 'Name')).toBeRejectedWithError('Role check failed');
    await expectAsync(service.deletePatientToken(7)).toBeRejectedWithError('Role check failed');
    expect(query.update).not.toHaveBeenCalled(); expect(query.delete).not.toHaveBeenCalled();
  });

  it('allows an administrator to delete only the requested token after checking the current role', async () => {
    client.rpc.and.resolveTo({ data: true, error: null }); query.select.and.resolveTo({ data: [{ id: 7 }], error: null });
    await service.deletePatientToken(7);
    expect(client.rpc).toHaveBeenCalledWith('hmc_is_admin'); expect(client.from).toHaveBeenCalledWith('patient_token_slips'); expect(query.delete).toHaveBeenCalled(); expect(query.eq).toHaveBeenCalledWith('id', 7);
  });

  it('updates existing IDs in collections with nonstandard record keys', async () => {
    query.range.and.returnValue(Promise.resolve({
      data: [{ record_id: '3', data: { inpatientId: 3, patientName: 'Old' } }],
      error: null,
    }));
    await service.setItem('inpatientDetails', [{ inpatientId: 3, patientName: 'New' }]);

    expect(client.rpc).toHaveBeenCalledWith('apply_hmc_record_changes', {
      p_collection: 'inpatientDetails',
      p_inserts: [],
      p_updates: [{ record_id: '3', data: { inpatientId: 3, patientName: 'New' }, sort_order: 0 }],
      p_delete_ids: [],
    });
  });

  it('does not delete remote rows missing from a partial client list', async () => {
    query.range.and.returnValue(Promise.resolve({
      data: [
        { record_id: '1', data: { patientId: 1 } },
        { record_id: '2', data: { patientId: 2 } },
      ],
      error: null,
    }));
    await service.setItem('patientDetails', [{ patientId: 1 }]);

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('updates remote rows removed from the application array without deleting unrelated records', async () => {
    query.range.and.returnValue(Promise.resolve({
      data: [
        { record_id: '1', data: { patientId: 1, name: 'Before' } },
        { record_id: '2', data: { patientId: 2, name: 'Keep' } },
      ],
      error: null,
    }));
    await service.setItem('patientDetails', [{ patientId: 1, name: 'Updated' }]);

    expect(client.rpc).toHaveBeenCalledWith('apply_hmc_record_changes', {
      p_collection: 'patientDetails',
      p_inserts: [],
      p_updates: [{ record_id: '1', data: { patientId: 1, name: 'Updated' }, sort_order: 0 }],
      p_delete_ids: [],
    });
  });

  it('deletes a specific record through the atomic RPC', async () => {
    await service.deleteRecord('patientDetails', 7);

    expect(client.rpc).toHaveBeenCalledWith('apply_hmc_record_changes', {
      p_collection: 'patientDetails',
      p_inserts: [],
      p_updates: [],
      p_delete_ids: ['7'],
    });
  });

  it('routes both new and existing single-record saves through the conflict-safe insert branch', async () => {
    const record = { id: '5', name: 'New medicine', active: true };
    await service.upsertRecord('prescriptionMedicineCatalog', '5', record, 4);
    await service.upsertRecord('prescriptionMedicineCatalog', '5', { ...record, name: 'Edited medicine' }, 4);
    expect(client.rpc.calls.count()).toBe(2);
    for (const [, args] of client.rpc.calls.allArgs()) {
      expect(args.p_inserts.length).toBe(1); expect(args.p_inserts[0].record_id).toBe('5');
      expect(args.p_updates).toEqual([]); expect(args.p_delete_ids).toEqual([]);
    }
  });

  it('uses the database token generator and maps its saved row', async () => {
    client.rpc.and.returnValue(Promise.resolve({
      data: {
        id: 12,
        token_number: 'A001',
        sequence: 1,
        customer_name: 'Ali Khan',
        token_date: '2026-11-11',
        token_time: '10:30 AM',
        created_at: '2026-11-11T05:30:00.000Z',
      },
      error: null,
    }));

    const slip = await service.createPatientToken(' Ali Khan ', '2026-11-11T10:30');

    expect(client.rpc).toHaveBeenCalledWith('create_patient_token_at', {
      p_customer_name: 'Ali Khan',
      p_token_date: '2026-11-11', p_token_time: '10:30',
    });
    expect(slip).toEqual({
      id: 12,
      tokenNumber: 'A001',
      sequence: 1,
      customerName: 'Ali Khan',
      date: '2026-11-11',
      time: '10:30 AM',
      createdAt: '2026-11-11T05:30:00.000Z',
    });
  });

  it('rejects missing or invalid token dates before making a database request', async () => {
    for (const date of ['', '2020-02-30T12:00', '2020-01-01T24:00', '2020-01-01', 'invalid']) {
      await expectAsync(service.createPatientToken('Ali', date)).toBeRejectedWithError('Select a valid token date and time.');
    }
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('surfaces Supabase failures rather than returning success-shaped data', async () => {
    query.range.and.returnValue(Promise.resolve({
      data: null,
      error: { message: 'Network unavailable' },
    }));

    await expectAsync(service.getItem<any[]>('patientDetails'))
      .toBeRejectedWithError('Network unavailable');
  });
  it('uses the stored row key for prescriptions even if the payload ID is stale or missing', async () => {
    query.range.and.resolveTo({ data: [{ record_id: '42', data: { id: '7', patient: { name: 'Ali' } } }, { record_id: '43', data: { patient: { name: 'Sara' } } }], error: null });
    expect((await service.getItem<any[]>('prescriptions'))!.map(row => row.id)).toEqual(['42', '43']);
  });
  it('verifies admin prescription deletion against the returned database row and refreshes subscribers', async () => {
    client.rpc.and.resolveTo({ data: true, error: null });
    query.select.and.resolveTo({ data: [{ record_id: '42' }], error: null });
    const changes = jasmine.createSpy('changes'); service.changes.subscribe(changes);
    await service.deletePrescriptionRecord('prescriptions', '42');
    expect(query.delete).toHaveBeenCalledTimes(1); expect(query.eq).toHaveBeenCalledWith('collection', 'prescriptions'); expect(query.eq).toHaveBeenCalledWith('record_id', '42');
    expect(changes).toHaveBeenCalledWith('prescriptions');
    query.select.and.resolveTo({ data: [], error: null });
    await expectAsync(service.deletePrescriptionRecord('prescriptions', '42')).toBeRejectedWithError(/not deleted/);
    expect(changes).toHaveBeenCalledTimes(1);
  });
  it('blocks staff prescription deletion and surfaces database errors without reporting success', async () => {
    client.rpc.and.resolveTo({ data: false, error: null });
    await expectAsync(service.deletePrescriptionRecord('prescriptions', '42')).toBeRejectedWithError('Only administrators can delete prescriptions.'); expect(query.delete).not.toHaveBeenCalled();
    client.rpc.and.resolveTo({ data: true, error: null }); query.select.and.resolveTo({ data: null, error: { message: 'Network unavailable' } });
    await expectAsync(service.deletePrescriptionRecord('prescriptions', '42')).toBeRejectedWithError('Network unavailable');
  });
});
