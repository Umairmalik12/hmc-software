import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

const LABELS: Record<string, string> = {
  patientId: 'MR number', inpatientId: 'Inpatient ID', medicineId: 'Medicine record', firstName: 'Patient name',
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
  template: `<h2 mat-dialog-title><mat-icon>visibility</mat-icon><span>{{ title }}<small>Read-only record preview</small></span></h2><mat-dialog-content><dl class="record-details-grid"><div *ngFor="let field of fields"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl></mat-dialog-content><mat-dialog-actions><button mat-stroked-button type="button" mat-dialog-close>Close</button></mat-dialog-actions>`,
  styles: [':host{display:flex;flex-direction:column;min-height:0}.record-details-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:0;padding:0 0 16px}.record-details-grid>div{min-width:0}.record-details-grid dt{font-size:11px;color:#71858e;margin-bottom:5px}.record-details-grid dd{margin:0;font-size:13px;color:#213f49;white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:520px){.record-details-grid{grid-template-columns:1fr}}'],
})
export class RecordDetailsComponent {
  title: string;
  fields: Array<{ label: string; value: string }>;
  constructor(@Inject(MAT_DIALOG_DATA) data: { title: string; record: object }) {
    this.title = data.title;
    this.fields = Object.entries(data.record).filter(([key]) => !HIDDEN_FIELDS.has(key))
      .map(([key, value]) => ({ label: this.label(key), value: this.format(value, key) }));
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
