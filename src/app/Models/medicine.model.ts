export interface Medicine {
  medicineId: number;
  roomNo: string;
  patientName: string;
  medicines: { medicineName: string; quantity: number }[];
  doctorName: string;
  createdAt: string;
}

