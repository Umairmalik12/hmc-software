import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { Subject } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';

export interface PatientTokenSlip {
  id: number;
  tokenNumber: string;
  sequence: number;
  customerName: string;
  date: string;
  time: string;
  createdAt: string;
}

interface StoredRecord {
  record_id: string;
  data: any;
}

interface RecordChange {
  record_id: string;
  data: any;
  sort_order: number;
}

const SINGLETON_ID = '__singleton__';

@Injectable({
  providedIn: 'root'
})
export class SupabaseDataService {
  readonly changes = new Subject<string>();
  private collectionSnapshots = new Map<string, any[]>();
  private realtimeStarted = false;

  constructor(private supabase: SupabaseClientService) {}

  async setItem(key: string, value: any): Promise<void> {
    if (!Array.isArray(value)) {
      const { error } = await this.client
        .from('hmc_records')
        .upsert({ collection: key, record_id: SINGLETON_ID, data: value, sort_order: 0 });
      this.throwIfError(error);
      this.collectionSnapshots.delete(key);
      return;
    }

    const snapshot = this.collectionSnapshots.has(key)
      ? this.collectionSnapshots.get(key)!
      : (await this.getItem<any[]>(key) || []);
    const previous = new Map<string, { item: any; index: number }>();
    snapshot.forEach((item, index) => previous.set(this.getRecordId(key, item), { item, index }));
    const current = new Map<string, { item: any; index: number }>();
    value.forEach((item, index) => {
      const id = this.getRecordId(key, item);
      if (current.has(id)) {
        throw new Error('Duplicate record ID ' + id + ' in ' + key + '.');
      }
      current.set(id, { item, index });
    });
    const inserts: RecordChange[] = [];
    const updates: RecordChange[] = [];

    current.forEach(({ item, index }, id) => {
      const oldRecord = previous.get(id);
      if (!oldRecord) {
        inserts.push({ record_id: id, data: item, sort_order: index });
      } else if (
        JSON.stringify(oldRecord.item) !== JSON.stringify(item) ||
        oldRecord.index !== index
      ) {
        updates.push({ record_id: id, data: item, sort_order: index });
      }
    });

    const deletes = Array.from(previous.keys()).filter(id => !current.has(id));
    if (inserts.length || updates.length || deletes.length) {
      const { error } = await this.client.rpc('apply_hmc_record_changes', {
        p_collection: key,
        p_inserts: inserts,
        p_updates: updates,
        p_delete_ids: deletes,
      });
      this.throwIfError(error);
    }

    this.collectionSnapshots.set(key, this.clone(value));
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const records: StoredRecord[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.client
        .from('hmc_records')
        .select('record_id,data')
        .eq('collection', key)
        .order('sort_order', { ascending: true })
        .order('record_id', { ascending: true })
        .range(offset, offset + 999);
      this.throwIfError(error);
      records.push(...(data || []) as StoredRecord[]);
      if (!data || data.length < 1000) {
        break;
      }
    }

    if (records.length === 1 && records[0].record_id === SINGLETON_ID) {
      return records[0].data as T;
    }

    const values = records
      .filter(record => record.record_id !== SINGLETON_ID)
      .map(record => record.data);
    this.collectionSnapshots.set(key, this.clone(values));
    return values as T;
  }

  async allocateId(collection: string): Promise<number> {
    const { data, error } = await this.client.rpc('next_hmc_id', {
      p_collection: collection,
    });
    this.throwIfError(error);
    const id = Number(data);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new Error('Supabase returned an invalid record ID.');
    }
    return id;
  }

  async createPatientToken(customerName: string): Promise<PatientTokenSlip> {
    const name = customerName.trim();
    if (!name) {
      throw new Error('Patient name is required.');
    }

    const { data, error } = await this.client.rpc('create_patient_token', {
      p_customer_name: name,
    });
    this.throwIfError(error);
    if (!data) {
      throw new Error('Supabase did not return the generated patient token.');
    }

    return {
      id: Number(data.id),
      tokenNumber: data.token_number,
      sequence: Number(data.sequence),
      customerName: data.customer_name,
      date: data.token_date,
      time: data.token_time,
      createdAt: data.created_at,
    };
  }

  async getPatientTokensByDate(date: string): Promise<PatientTokenSlip[]> {
    const slips: PatientTokenSlip[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.client
        .from('patient_token_slips')
        .select('id,token_number,sequence,customer_name,token_date,token_time,created_at')
        .eq('token_date', date)
        .order('sequence', { ascending: true })
        .range(offset, offset + 999);
      this.throwIfError(error);
      slips.push(...(data || []).map(row => this.mapToken(row)));
      if (!data || data.length < 1000) {
        return slips;
      }
    }
  }

  async getAllPatientTokens(): Promise<PatientTokenSlip[]> {
    const slips: PatientTokenSlip[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.client
        .from('patient_token_slips')
        .select('id,token_number,sequence,customer_name,token_date,token_time,created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + 999);
      this.throwIfError(error);
      slips.push(...(data || []).map(row => this.mapToken(row)));
      if (!data || data.length < 1000) {
        return slips;
      }
    }
  }

  async deletePatientToken(id: number): Promise<void> {
    const { data, error } = await this.client
      .from('patient_token_slips')
      .delete()
      .eq('id', id)
      .select('id');
    this.throwIfError(error);
    if (!data || !data.length) {
      throw new Error('Patient token was not found or could not be deleted.');
    }
  }

  private getRecordId(collection: string, item: any): string {
    if (collection === 'customMedicines' && typeof item === 'string') {
      return item;
    }

    const fields: { [key: string]: string } = {
      patientDetails: 'patientId',
      opdDetails: 'patientId',
      medicineDetails: 'medicineId',
      labDetails: 'patientId',
      inpatientDetails: 'inpatientId',
    };
    const id = item && (item[fields[collection] || 'id'] ?? item.id);
    if (id === undefined || id === null || String(id) === '') {
      throw new Error('Cannot save a ' + collection + ' record without a stable ID.');
    }
    return String(id);
  }

  private get client(): SupabaseClient {
    const client = this.supabase.client;
    if (!this.realtimeStarted) {
      this.realtimeStarted = true;
      client.channel('hmc-shared-records')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'hmc_records',
        }, payload => {
          const record = (payload.new || payload.old) as { collection?: string };
          if (record.collection) {
            this.changes.next(record.collection);
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'patient_token_slips',
        }, () => this.changes.next('patientTokens'))
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Supabase real-time updates are unavailable:', status);
          }
        });
    }
    return client;
  }

  private mapToken(row: any): PatientTokenSlip {
    return {
      id: Number(row.id),
      tokenNumber: row.token_number,
      sequence: Number(row.sequence),
      customerName: row.customer_name,
      date: row.token_date,
      time: row.token_time,
      createdAt: row.created_at,
    };
  }

  private clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  private throwIfError(error: { message: string } | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
