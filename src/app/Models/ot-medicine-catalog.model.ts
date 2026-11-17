export interface OtCatalogMedicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  type: string;
  strength: string;
  unit: string;
  description: string;
  active: boolean;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const OT_MEDICINE_TYPES = ['Injection', 'Tablet', 'Capsule', 'Syrup', 'Infusion', 'Solution', 'Gel', 'Cream', 'Ointment', 'Drops', 'Supply', 'Other'];
export const OT_MEDICINE_UNITS = ['Ampoule', 'Vial', 'Tablet', 'Capsule', 'Bottle', 'Tube', 'Bag', 'Pack', 'Piece', 'Pair', 'Set', 'ml', 'g'];
export const otMedicineKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();
export function emptyOtCatalogMedicine(): OtCatalogMedicine {
  return { id: '', name: '', genericName: '', category: '', type: '', strength: '', unit: '', description: '', active: true, deleted: false };
}
