import { SupabaseClientService } from '../Services/supabase-client.service';
import { SupabaseDataService } from '../Services/supabase-data.service';

/** Exercise the real data service against the older RPC contract, not a mocked upsertRecord. */
export function legacyRpcDb() {
  const collections = new Map<string, Map<string, any>>();
  const rows = (collection: string): Map<string, any> => {
    if (!collections.has(collection)) collections.set(collection, new Map());
    return collections.get(collection)!;
  };
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const channel = { on: (..._args: unknown[]) => channel, subscribe: () => channel };
  const client = {
    channel: () => channel,
    from: (_table: string) => {
      let collection = '';
      const query = {
        insert: async (record: { collection: string; record_id: string; data: unknown }) => {
          if (rows(record.collection).has(record.record_id)) return { error: { message: 'This record already exists.' } };
          rows(record.collection).set(record.record_id, clone(record.data)); return { error: null };
        },
        select: () => query,
        eq: (field: string, value: string) => { if (field === 'collection') collection = value; return query; },
        order: () => query,
        range: async (start: number, end: number) => ({ data: Array.from(rows(collection), ([record_id, data]) => ({ record_id, data: clone(data) })).slice(start, end + 1), error: null }),
      };
      return query;
    },
    rpc: jasmine.createSpy('legacyRpc').and.callFake(async (name: string, args: any) => {
      const stored = rows(args.p_collection);
      if (name === 'next_hmc_id') return { data: Math.max(4, ...Array.from(stored.keys()).filter(id => /^\d+$/.test(id)).map(Number)) + 1, error: null };
      if (name !== 'apply_hmc_record_changes') throw new Error('Unsupported test RPC: ' + name);
      // Older deployments reject missing IDs in p_updates, including lazy defaults.
      for (const row of args.p_updates || []) if (!stored.has(row.record_id)) return { data: null, error: { message: 'Record ID ' + row.record_id + ' was not found in ' + args.p_collection } };
      for (const id of args.p_delete_ids || []) stored.delete(id);
      for (const row of [...(args.p_inserts || []), ...(args.p_updates || [])]) stored.set(row.record_id, clone(row.data));
      return { data: null, error: null };
    }),
  };
  return { db: new SupabaseDataService({ client } as unknown as SupabaseClientService), collections, rpc: client.rpc };
}
