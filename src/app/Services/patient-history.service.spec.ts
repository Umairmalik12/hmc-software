import { memoryDb } from '../testing/memory-db';
import { PatientHistoryService } from './patient-history.service';
import { PatientLookupService } from './patient-lookup.service';
import { LabService } from './lab.service';

describe('patient MR lookup and history', () => {
  it('looks up only the existing master patient with the exact MR', async () => {
    const { db, collections } = memoryDb();
    collections.set('patientDetails', new Map([
      ['8123', { patientId: 8123, firstName: 'Ali', lastName: 'Khan' }],
      ['8124', { patientId: 8124, firstName: 'Sara' }],
    ]));
    const lookup = new PatientLookupService(db);
    expect(await lookup.byMr('8123')).toEqual(jasmine.objectContaining({ patientId: 8123, firstName: 'Ali' }));
    expect(await lookup.byMr('812')).toBeUndefined();
    expect(await lookup.byMr('8.5')).toBeUndefined();
  });

  it('groups repeated visits and module records under one MR, newest first', async () => {
    const { db, collections } = memoryDb();
    collections.set('opdDetails', new Map([
      ['visit-old', { visitId: 'visit-old', patientId: 8123, patientName: 'Ali', date: '2026-11-20', time: '09:00', drName: 'Dr A' }],
      ['visit-new', { visitId: 'visit-new', patientId: 8123, patientName: 'Ali', date: '2026-11-22', time: '10:00', drName: 'Dr B' }],
    ]));
    collections.set('labDetails', new Map([
      ['lab-1', { labId: 'lab-1', mrNumber: 8123, dateTime: '2026-11-21T11:00:00Z', testName: 'CBC' }],
      ['lab-2', { labId: 'lab-2', mrNumber: 9999, dateTime: '2026-11-23T11:00:00Z', testName: 'Unlinked' }],
    ]));
    collections.set('inpatientDetails', new Map([
      ['10', { inpatientId: 10, mrNumber: 8123, admissionDate: '2026-11-19', patientName: 'Ali' }],
    ]));

    const history = await new PatientHistoryService(db).forPatients([8123]);
    expect(history.get(8123)!.map(entry => entry.module)).toEqual(['OPD visit', 'Laboratory', 'OPD visit', 'Inpatient admission']);
    expect(history.get(8123)!.filter(entry => entry.module === 'OPD visit').length).toBe(2);
    expect(history.has(9999)).toBeFalse();
  });

  it('allows separate lab transactions for one MR while keeping unique lab keys', async () => {
    const { db, collections } = memoryDb();
    const labs = new LabService(db);
    const create = (testName: string) => labs.addNewLabPatient({ mrNumber: 8123, patientId: 8123, name: 'Ali Khan', phone: '', testName, price: 500, suggestedDr: '', dateTime: '2026-11-24T10:00:00Z' });
    expect(await create('CBC')).toBeTrue();
    expect(await create('Urine')).toBeTrue();
    const records = Array.from(collections.get('labDetails')!.values());
    expect(records.length).toBe(2);
    expect(new Set(records.map(record => record.labId)).size).toBe(2);
    expect(records.every(record => record.mrNumber === 8123)).toBeTrue();
  });
});
