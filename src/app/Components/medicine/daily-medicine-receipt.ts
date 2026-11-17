import { Medicine } from 'src/app/Models/medicine.model';
import { escapeHtml } from 'src/app/Shared/escape-html';

export const DAILY_MEDICINE_RECEIPT_CSS = `
.daily-medicine-receipt{text-align:center;overflow-wrap:anywhere;color:#000;background:#fff}
.daily-medicine-receipt .slip-brand{font-size:12pt;font-weight:900;line-height:1.15}
.daily-medicine-receipt .slip-title{font-size:8pt;font-weight:700;letter-spacing:.55pt;line-height:1.3;margin:1mm 0 2mm;padding-bottom:1.5mm;border-bottom:1.5px solid #000}
.daily-medicine-receipt .slip-row{display:grid;grid-template-columns:15mm minmax(0,1fr);gap:1.5mm;align-items:baseline;text-align:left;font-size:8pt;line-height:1.35;margin:.8mm 0}
.daily-medicine-receipt .slip-label{font-weight:700;text-transform:none;letter-spacing:0}
.daily-medicine-receipt .slip-value{min-width:0;text-align:right;white-space:normal;overflow-wrap:anywhere;font-weight:500}
.daily-medicine-receipt .medicine-patient-block{margin:1.5mm 0;padding:1mm 0;border-top:1px dashed #000;border-bottom:1px dashed #000}
.daily-medicine-receipt .patient-row .slip-value{font-size:9pt;font-weight:800}
.daily-medicine-receipt .room-row .slip-value{font-size:8.5pt;font-weight:800}
.daily-medicine-receipt .medicine-items{margin:2mm 0;text-align:left;border-bottom:1px solid #000;font-size:8.5pt;line-height:1.4}
.daily-medicine-receipt .medicine-line{display:grid;grid-template-columns:4mm minmax(0,1fr) 9mm;gap:1.25mm;align-items:baseline;padding:1mm 0;border-bottom:1px dotted #000;break-inside:avoid}
.daily-medicine-receipt .medicine-line>span{min-width:0;overflow-wrap:anywhere;white-space:normal}
.daily-medicine-receipt .medicine-index{font-size:7pt}
.daily-medicine-receipt .medicine-line>span:last-child{text-align:right;font-weight:700}
.daily-medicine-receipt .medicine-heading{font-size:8pt;font-weight:700;border-top:1.5px solid #000;border-bottom:1px solid #000}
.daily-medicine-receipt .medicine-line:last-child{border-bottom:0}
.daily-medicine-receipt .medicine-heading:last-child{border-bottom:1px solid #000}
.daily-medicine-receipt .medicine-empty{padding:1.5mm 0;margin:0;font-size:8pt}
.daily-medicine-receipt .items-total{margin-top:1.5mm;font-weight:700}
.daily-medicine-receipt .items-total .slip-value{font-weight:700}
.daily-medicine-receipt .slip-footer{margin-top:2mm;font-size:7pt;font-weight:700}
.daily-medicine-receipt .slip-thanks{margin-top:1mm;font-size:9pt;font-weight:900}
.daily-medicine-receipt .slip-brand,.daily-medicine-receipt .slip-title,.daily-medicine-receipt .slip-footer,.daily-medicine-receipt .slip-thanks{text-align:center;white-space:normal;overflow-wrap:anywhere}
`;

export function buildDailyMedicineReceipt(record: Medicine): string {
  const row = (label: string, value: unknown, extraClass = ''): string => `<div class="slip-row ${extraClass}"><span class="slip-label">${escapeHtml(label)}</span><span class="slip-value">${escapeHtml(value === '' || value == null ? 'Not recorded' : value)}</span></div>`;
  const date = record.createdAt ? new Date(record.createdAt) : null;
  const hasDate = date && !Number.isNaN(date.getTime());
  const items = record.medicines || [];
  return `<section id="daily-medicine-receipt" class="daily-medicine-receipt"><div class="slip-brand">HAQ MEDICAL CENTER</div><div class="slip-title">DAILY MEDICINE RECEIPT</div>
    ${row('Receipt', '#' + record.medicineId)}${row('Date', hasDate ? date.toLocaleDateString('en-GB') : '')}${row('Time', hasDate ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '')}
    <div class="medicine-patient-block">${row('Patient', record.patientName, 'patient-row')}${row('Room/bed', record.roomNo, 'room-row')}</div>${row('Doctor', record.doctorName)}
    <div class="medicine-items" role="table" aria-label="Medicines and quantities"><div class="medicine-line medicine-heading" role="row"><span role="columnheader" aria-label="Number">#</span><span role="columnheader">Medicine</span><span role="columnheader">Qty</span></div>
    ${items.map((item, index) => `<div class="medicine-line" role="row"><span class="medicine-index" role="cell">${index + 1}</span><span class="medicine-name" role="cell">${escapeHtml(item.medicineName)}</span><span class="medicine-quantity" role="cell">${escapeHtml(item.quantity)}</span></div>`).join('')}
    ${!items.length ? '<p class="medicine-empty">No medicines recorded.</p>' : ''}</div>
    ${row('Items', items.length, 'items-total')}<div class="slip-footer">PLEASE KEEP THIS RECEIPT</div><div class="slip-thanks">THANK YOU!</div></section>`;
}
