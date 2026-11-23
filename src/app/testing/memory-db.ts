import { Subject } from 'rxjs';
import { SupabaseDataService } from '../Services/supabase-data.service';

export function memoryDb(): { db: SupabaseDataService; collections: Map<string, Map<string, any>> } {
  const collections = new Map<string, Map<string, any>>();
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const rows = (collection: string): Map<string, any> => {
    if (!collections.has(collection)) collections.set(collection, new Map());
    return collections.get(collection)!;
  };
  const changes = new Subject<string>();
  const db = {
    changes,
    requireAdministrator: jasmine.createSpy('requireAdministrator').and.resolveTo(),
    deletePrescriptionRecord: jasmine.createSpy('deletePrescriptionRecord').and.callFake(async (collection: string, id: string) => {
      await db.requireAdministrator('Only administrators can delete prescriptions.');
      if (!rows(collection).delete(id)) throw new Error('The prescription was not deleted.');
      changes.next(collection);
    }),
    getItem: jasmine.createSpy('getItem').and.callFake(async (collection: string) => rows(collection).size === 1 && rows(collection).has('__singleton__')
      ? clone(rows(collection).get('__singleton__')) : Array.from(rows(collection), ([id, value]) => collection === 'prescriptions' ? { ...clone(value), id } : clone(value))),
    allocateId: jasmine.createSpy('allocateId').and.callFake(async (collection: string) => Math.max(0, ...Array.from(rows(collection).keys()).map(key => Number(key) || 0)) + 1),
    insertRecord: jasmine.createSpy('insertRecord').and.callFake(async (collection: string, id: string | number, value: any) => {
      if (rows(collection).has(String(id))) throw new Error('This record already exists.');
      rows(collection).set(String(id), clone(value)); changes.next(collection);
    }),
    upsertRecord: jasmine.createSpy('upsertRecord').and.callFake(async (collection: string, id: string | number, value: any) => { rows(collection).set(String(id), clone(value)); changes.next(collection); }),
    deleteRecord: jasmine.createSpy('deleteRecord').and.callFake(async (collection: string, id: string | number) => { rows(collection).delete(String(id)); changes.next(collection); }),
    moveRecord: jasmine.createSpy('moveRecord').and.callFake(async (collection: string, oldId: string | number, id: string | number, value: any) => { rows(collection).delete(String(oldId)); rows(collection).set(String(id), clone(value)); changes.next(collection); }),
    setItem: jasmine.createSpy('setItem').and.callFake(async (collection: string, value: any) => {
      if (!Array.isArray(value)) rows(collection).set('__singleton__', clone(value));
      else value.forEach(item => rows(collection).set(String(item.id ?? item.patientId ?? item.medicineId ?? item.inpatientId ?? item), clone(item)));
      changes.next(collection);
    }),
  };
  return { db: db as unknown as SupabaseDataService, collections };
}
