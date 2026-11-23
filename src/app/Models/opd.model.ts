export interface Opd {
    /** Stable identifier for this encounter. Legacy visits use their stored record key. */
    visitId?: string;
    patientId: number;
    date: string;
    time: string;
    patientName: string;
    age: number;
    sex: string;
    bp: string;
    temp: string;
    weight: string;
    patientCategory: string;
    procedure?: string;
    amount: number;
    phone: string;
    address: string;
    history: string;
    drName: string;
    followUp: string;
    createdAt: string;
  }

