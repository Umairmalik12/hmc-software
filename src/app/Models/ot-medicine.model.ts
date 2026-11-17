export interface OtMedicineItem {
  name: string; quantity: number; selected?: boolean; amount?: number;
  catalogueId?: string; genericName?: string; category?: string; type?: string; strength?: string; unit?: string;
}
export interface OtMedicineRecord {
  id: string;
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
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return { id: '', patientName: '', doctorName: '', roomNumber: '', procedure: '',
    operationDate: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
    operationTime: pad(now.getHours()) + ':' + pad(now.getMinutes()), includeMedicineHeader: 'withMedicine', products: [], createdAt: '' };
}

export function copyOtRecord(record: OtMedicineRecord): OtMedicineRecord {
  return { ...record, products: record.products.map(product => ({ ...product })) };
}
