export interface OtMedicineItem {
  name: string; quantity: number; selected?: boolean; amount?: number;
  catalogueId?: string; genericName?: string; category?: string; type?: string; strength?: string; unit?: string;
}
export interface OtMedicineRecord {
  id: string;
  mrNumber?: number;
  patientName: string;
  doctorName: string;
  roomNumber: string;
  procedure: string;
  operationDate: string;
  operationTime: string;
  includeMedicineHeader: string;
  products: OtMedicineItem[];
  createdAt: string;
  updatedAt?: string;
}

export function emptyOtRecord(): OtMedicineRecord {
  return { id: '', patientName: '', doctorName: '', roomNumber: '', procedure: '',
    operationDate: '', operationTime: '', includeMedicineHeader: 'withMedicine', products: [], createdAt: '' };
}

export function copyOtRecord(record: OtMedicineRecord): OtMedicineRecord {
  return { ...record, products: record.products.map(product => ({ ...product })) };
}
