import { OtMedicineItem, OtMedicineRecord } from 'src/app/Models/ot-medicine.model';
import { escapeHtml } from 'src/app/Shared/escape-html';
import { printA4 } from 'src/app/Shared/print-a4';
import { formatTime12 } from 'src/app/Pipes/time-format.pipe';

export const OT_DOCUMENT_CSS = `
.ot-print-sheet{width:190mm;max-width:100%;margin:0 auto;background:#fff;color:#000;font:11px/1.35 Arial,sans-serif}
.ot-print-sheet h1{margin:0;text-align:center;font-size:21px;font-weight:bold}.ot-print-sheet h2{margin:3px 0 14px;text-align:center;font-size:14px;font-weight:bold}
.ot-print-sheet .ot-print-meta{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:10px;border:1px solid #333}
.ot-print-sheet .ot-print-meta div{min-width:0;padding:6px 8px;overflow-wrap:anywhere}.ot-print-sheet .ot-print-meta .ot-print-wide{grid-column:1/-1;border-top:1px solid #333}
.ot-print-sheet table{width:100%;border-collapse:collapse;table-layout:fixed}.ot-print-sheet th,.ot-print-sheet td{border:1px solid #333;padding:4px 6px;white-space:normal;overflow-wrap:anywhere}
.ot-print-sheet th{background:#f1f1f1;text-align:center;font-size:10px;font-weight:bold}.ot-print-sheet th:nth-child(1){width:10mm}.ot-print-sheet th:nth-child(3){width:23mm}.ot-print-sheet th:nth-child(4){width:28mm}
.ot-print-sheet td:first-child,.ot-print-sheet td:nth-child(3){text-align:center}.ot-print-sheet td:last-child{text-align:right}
.ot-print-sheet .ot-print-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;font-size:10px}.ot-print-sheet .ot-print-signature{border-top:1px solid #555;padding-top:5px;min-width:40mm;text-align:center}
.ot-print-sheet .ot-print-stamp{margin-top:12px;text-align:center;font-size:9px;color:#555}
`;

export function buildOtMedicineDocument(record: OtMedicineRecord): string {
  const row = (label: string, value: unknown, wide = false): string => `<div${wide ? ' class="ot-print-wide"' : ''}><b>${label}:</b> ${escapeHtml(value || '—')}</div>`;
  // Print saved snapshots, never the current master: older slips must stay accurate.
  const medicineName = (product: OtMedicineItem): string => {
    const compact = (text: string): string => text.replace(/\s+/g, '').toLowerCase();
    return product.strength && !compact(product.name).includes(compact(product.strength)) ? product.name + ' · ' + product.strength : product.name;
  };
  const products = record.products.filter(product => product.selected !== false);
  return `<article class="ot-print-sheet"><h1>Ahmmad Pharmacy</h1><h2>OT Medicine &amp; Supplies List</h2>
    <div class="ot-print-meta">${row('Patient', record.patientName)}${row('Doctor', record.doctorName)}${row('Operation date', record.operationDate)}${row('Time', formatTime12(record.operationTime))}${row('Room', record.roomNumber)}${row('Record', record.id)}${row('Procedure', record.procedure, true)}</div>
    <table><thead><tr><th>S. No.</th><th>Name</th><th>Qty.</th><th>Amount</th></tr></thead><tbody>${products.map((product, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(medicineName(product))}</td><td>${escapeHtml(product.quantity)}${product.unit ? ' ' + escapeHtml(product.unit) : ''}</td><td>${typeof product.amount === 'number' && Number.isFinite(product.amount) ? escapeHtml(product.amount.toLocaleString('en-PK', { maximumFractionDigits: 2 })) : '&nbsp;'}</td></tr>`).join('')}</tbody></table>
    <div class="ot-print-footer"><div class="ot-print-signature">Patient / attendant signature</div><div class="ot-print-signature">Pharmacy signature</div></div>
    <div class="ot-print-stamp">Haq Medical Center · ${record.includeMedicineHeader === 'withoutMedicine' ? 'Without medicine' : 'With medicine'}</div></article>`;
}

export function printOtMedicine(record: OtMedicineRecord, target?: Window | null): boolean {
  return printA4(buildOtMedicineDocument(record), OT_DOCUMENT_CSS, 'OT Medicine List', target);
}
