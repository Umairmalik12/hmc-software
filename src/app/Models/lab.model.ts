export interface LabPatient {
    /** Lab transaction key; different from the patient MR number. */
    labId?: string;
    mrNumber?: number;
    /** Kept for compatibility with old records and receipt readers. */
    patientId?: number;
    name: string;
    phone: string;
    testName: string;
    price: number;
    suggestedDr: string;
    dateTime: Date | string;
  }
