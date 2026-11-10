import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'MyAppDB';
const STORE_NAME = 'keyval';
const TOKEN_STORE_NAME = 'patientTokenSlips';
const TOKEN_SEQUENCE_STORE_NAME = 'patientTokenDailySequences';
const DB_VERSION = 2;

export interface PatientTokenSlip {
  id: number;
  tokenNumber: string;
  sequence: number;
  customerName: string;
  date: string;
  time: string;
  createdAt: string;
}

interface DailyTokenSequence {
  date: string;
  nextSequence: number;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private async initDB() {
    let connection: IDBPDatabase | undefined;
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(TOKEN_STORE_NAME)) {
          const slips = db.createObjectStore(TOKEN_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          slips.createIndex('by-date', 'date');
          slips.createIndex('by-date-sequence', ['date', 'sequence'], { unique: true });
        }
        if (!db.objectStoreNames.contains(TOKEN_SEQUENCE_STORE_NAME)) {
          db.createObjectStore(TOKEN_SEQUENCE_STORE_NAME, { keyPath: 'date' });
        }
      },
      blocking() {
        if (connection) {
          connection.close();
        }
      },
    });
    connection = db;
    return db;
  }

  async setItem(key: string, value: any): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, value, key);
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const db = await this.dbPromise;
    return await db.get(STORE_NAME, key);
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, key);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(STORE_NAME);
  }

  async createPatientToken(customerName: string): Promise<PatientTokenSlip> {
    const name = customerName.trim();
    if (!name) {
      throw new Error('Patient name is required.');
    }

    const generatedAt = new Date();
    const date = this.getPakistanDate(generatedAt);
    const time = this.getPakistanTime(generatedAt);
    const db = await this.dbPromise;
    const transaction = db.transaction(
      [TOKEN_STORE_NAME, TOKEN_SEQUENCE_STORE_NAME],
      'readwrite'
    );
    const sequenceStore = transaction.objectStore(TOKEN_SEQUENCE_STORE_NAME);
    const dailySequence = await sequenceStore.get(date) as DailyTokenSequence | undefined;
    const sequence = dailySequence ? dailySequence.nextSequence : 1;
    const slip: Omit<PatientTokenSlip, 'id'> = {
      tokenNumber: 'A' + String(sequence).padStart(3, '0'),
      sequence,
      customerName: name,
      date,
      time,
      createdAt: generatedAt.toISOString(),
    };

    const id = await transaction.objectStore(TOKEN_STORE_NAME).add(slip) as number;
    await sequenceStore.put({ date, nextSequence: sequence + 1 });
    await transaction.done;
    return { ...slip, id };
  }

  async getPatientTokensByDate(date: string): Promise<PatientTokenSlip[]> {
    const db = await this.dbPromise;
    const slips = await db.getAllFromIndex(TOKEN_STORE_NAME, 'by-date', date);
    return (slips as PatientTokenSlip[]).sort((a, b) => a.sequence - b.sequence);
  }

  async getAllPatientTokens(): Promise<PatientTokenSlip[]> {
    const db = await this.dbPromise;
    return await db.getAll(TOKEN_STORE_NAME) as PatientTokenSlip[];
  }

  async deletePatientToken(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(TOKEN_STORE_NAME, id);
  }

  private getPakistanDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values: { [key: string]: string } = {};
    parts.forEach(part => values[part.type] = part.value);
    return values.year + '-' + values.month + '-' + values.day;
  }

  private getPakistanTime(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const values: { [key: string]: string } = {};
    parts.forEach(part => values[part.type] = part.value);
    return values.hour + ':' + values.minute + ' ' + values.dayPeriod.toUpperCase();
  }
}
