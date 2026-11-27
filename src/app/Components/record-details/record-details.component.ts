import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

const LABELS: Record<string, string> = {
  staffId: 'Staff ID',
  sourceOpdVisitId: 'Original OPD visit',
  expenseId: 'Expense ID',
  patientId: 'MR number', inpatientId: 'Patient ID', medicineId: 'Medicine record', firstName: 'Patient name',
  lastName: "Father's name", drName: 'Doctor', suggestedDr: 'Referred by', roomNo: 'Room', createdAt: 'Registered on',
  dateTime: 'Test date / time', bp: 'Blood pressure', temp: 'Temperature', sex: 'Gender', followUp: 'Follow-up',
  staffName: 'Counter staff', counterName: 'Counter / desk', shiftName: 'Shift', shiftDate: 'Shift date',
  cashGiven: 'Cash tendered', cashReturn: 'Change', recordedByEmail: 'Recorded by', updatedByEmail: 'Last updated by',
  updatedAt: 'Last updated', customerName: 'Patient name', tokenNumber: 'Token number', active: 'Available for selection',
};

const HIDDEN_FIELDS = new Set(['maritalStatus', 'oldId', 'oldPatientId', 'recordedById', 'updatedById']);
const MONEY_FIELDS = new Set(['amount', 'price', 'cashGiven', 'cashReturn']);

@Component({
  selector: 'app-record-details',
  templateUrl: './record-details.component.html',
  styleUrls: ['./record-details.component.css'],
})
export class RecordDetailsComponent {
  title: string;
  fields: Array<{ label: string; value: string; wide: boolean; empty: boolean; money: boolean }>;
  constructor(@Inject(MAT_DIALOG_DATA) data: { title: string; record: object }) {
    this.title = data.title;
    this.fields = Object.entries(data.record).filter(([key]) => !HIDDEN_FIELDS.has(key))
      .map(([key, value]) => {
        const formatted = this.format(value, key);
        return { label: this.label(key), value: formatted, money: MONEY_FIELDS.has(key), empty: value == null || value === '',
          wide: formatted.length > 100 || formatted.includes('\n') || /address|description|remarks|instructions|findings|diagnosis|symptoms|allergies/i.test(key) || !!value && typeof value === 'object' && !(value instanceof Date) };
      });
  }
  private label(key: string): string {
    return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
  }
  private format(value: unknown, key = ''): string {
    if (value == null || value === '') return 'Not recorded';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (MONEY_FIELDS.has(key) && Number.isFinite(Number(value))) return 'Rs ' + Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Not recorded' : value.toLocaleString('en-PK', { hour12: true });
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && !Number.isNaN(new Date(value).getTime())) {
      const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
      return value.length === 10 ? date.toLocaleDateString('en-PK') : date.toLocaleString('en-PK', { hour12: true });
    }
    if (Array.isArray(value)) return value.length ? value.map((item, index) => (item && typeof item === 'object' ? (index + 1) + '. ' : '') + this.format(item)).join('\n\n') : 'None recorded';
    if (typeof value === 'object') return Object.entries(value).filter(([name]) => !HIDDEN_FIELDS.has(name))
      .map(([name, part]) => this.label(name) + ': ' + this.format(part, name)).join('\n') || 'Not recorded';
    return String(value);
  }
}
