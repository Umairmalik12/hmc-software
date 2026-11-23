export interface PrescriptionPatient {
  refId: string;
  visit: string;
  name: string;
  relation: string;
  age: string;
  sex: string;
  weight: string;
  contact: string;
  allergies: string;
  symptoms: string;
  findings: string;
  diagnosis: string;
}

export interface PrescriptionMedicine {
  name: string;
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

export interface PrescriptionRecord {
  id: string;
  /** Links this prescription to one OPD encounter, not merely to the patient MR. */
  opdVisitId?: string;
  doctorName?: string;
  status?: 'draft' | 'completed';
  patient: PrescriptionPatient;
  medicines: PrescriptionMedicine[];
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function emptyPrescription(): PrescriptionRecord {
  return {
    id: '', issuedAt: '', createdAt: '', updatedAt: '',
    patient: { refId: '', visit: '', name: '', relation: '', age: '', sex: '', weight: '',
      contact: '', allergies: '', symptoms: '', findings: '', diagnosis: '' },
    medicines: [{ name: '', morning: false, afternoon: false, evening: false }],
  };
}

export function copyPrescription(record: PrescriptionRecord): PrescriptionRecord {
  return { ...record, patient: { ...record.patient }, medicines: record.medicines.map(medicine => ({ ...medicine })) };
}
