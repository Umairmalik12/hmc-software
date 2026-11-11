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
      select: jasmine.createSpy('select').and.callFake(() => query),
      eq: jasmine.createSpy('eq').and.callFake(() => query),
      order: jasmine.createSpy('order').and.callFake(() => query),
      range: jasmine.createSpy('range').and.returnValue(Promise.resolve({ data: [], error: null })),
      upsert: jasmine.createSpy('upsert').and.returnValue(Promise.resolve({ error: null })),
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

    const slip = await service.createPatientToken(' Ali Khan ');

    expect(client.rpc).toHaveBeenCalledWith('create_patient_token', {
      p_customer_name: 'Ali Khan',
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

  it('surfaces Supabase failures rather than returning success-shaped data', async () => {
    query.range.and.returnValue(Promise.resolve({
      data: null,
      error: { message: 'Network unavailable' },
    }));

    await expectAsync(service.getItem<any[]>('patientDetails'))
      .toBeRejectedWithError('Network unavailable');
  });
});
