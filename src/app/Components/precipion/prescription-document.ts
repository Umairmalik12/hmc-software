import { PrescriptionPatient, PrescriptionRecord } from 'src/app/Models/prescription.model';

export interface PrescriptionField {
  key: keyof PrescriptionPatient | 'date' | 'time';
  label: string;
  span?: number;
}

// These are the existing prescription fields, with automatic workstation time.
export const PRESCRIPTION_FIELDS: PrescriptionField[] = [
  { key: 'refId', label: 'MR No.' }, { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' }, { key: 'visit', label: 'Visit No.' },
  { key: 'name', label: 'Patient name', span: 2 }, { key: 'age', label: 'Age' }, { key: 'sex', label: 'Sex' },
  { key: 'weight', label: 'Weight', span: 1 }, { key: 'contact', label: 'Contact', span: 3 },
  { key: 'allergies', label: 'Allergies', span: 2 }, { key: 'findings', label: 'Findings', span: 2 },
  { key: 'symptoms', label: 'Symptoms / complaints', span: 2 }, { key: 'diagnosis', label: 'Diagnosis', span: 2 },
];

export const PRESCRIPTION_INSTRUCTIONS = 'Take medicines as prescribed. Complete the full course and return for follow-up in 7 days. Report side effects immediately.';

export const PRESCRIPTION_DOCUMENT_CSS = `
.rx-sheet{width:190mm;max-width:100%;margin:0 auto;background:#fff;color:#202b43;font:12px/1.5 Arial,sans-serif;box-sizing:border-box}
.rx-sheet *{box-sizing:border-box}
.rx-masthead{display:grid;grid-template-columns:1fr 82px 1fr;align-items:center;gap:18px;padding:18px 10px 12px}
.rx-doctor strong{display:block;font:italic bold 20px Georgia,serif;color:#20284e}
.rx-doctor span,.rx-clinic span{display:block;font-size:10px;line-height:1.55}
.rx-logo{display:block;width:82px;height:82px}
.rx-clinic{text-align:right}.rx-clinic strong{display:block;font-size:18px;letter-spacing:.2px;color:#20284e}
.rx-bismillah{font:16px/1.8 serif;direction:rtl}
.rx-title{margin:6px 0 18px;text-align:center;font:bold 23px/1.3 Arial,sans-serif;letter-spacing:.2px;color:#20284e}
.rx-section-title{margin:0;padding:7px 10px;border:1px solid #8c919b;background:#e9e9ed;color:#202633;font-size:11px;font-weight:bold}
.rx-doctor-details{display:grid;grid-template-columns:1fr 1fr;border:1px solid #8c919b;border-top:0;margin-bottom:12px}
.rx-doctor-details div{padding:7px 10px;font-size:10px}.rx-doctor-details div+div{border-left:1px solid #8c919b}
.rx-patient-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#a7aab1;border:1px solid #8c919b;border-top:0;margin-bottom:12px}
.rx-cell{display:block;min-width:0;min-height:48px;margin:0;padding:7px 10px;background:#fff;overflow-wrap:anywhere}
.rx-cell-label{display:block;margin-bottom:3px;color:#48515f;font-size:10px;font-weight:bold}
.rx-cell-value{display:block;min-height:20px;white-space:pre-wrap;color:#18253b}
.rx-sheet .rx-span-2{grid-column:span 2}.rx-sheet .rx-span-3{grid-column:span 3}
.rx-sheet .rx-input{display:block;width:100%;min-width:0;margin:0;padding:3px 0;border:0;border-bottom:1px dotted #cbd0d7;border-radius:0;outline-offset:2px;background:#fff;color:#18253b;font:inherit;line-height:1.5}
.rx-sheet .rx-input:focus{outline:2px solid #147d7350;border-bottom-color:#147d73}
.rx-sheet .rx-input[readonly]{border-bottom-color:transparent;color:#48515f}
.rx-medicines{width:100%;margin:0;border-collapse:collapse;table-layout:fixed;color:#18253b}
.rx-medicines th,.rx-medicines td{border:1px solid #8c919b;padding:8px 9px;overflow-wrap:anywhere;white-space:normal}
.rx-medicines th{background:#f3f3f5;font-size:10px;font-weight:bold;text-align:center}
.rx-medicines td{height:38px;vertical-align:middle}.rx-medicines th:first-child{width:55%;text-align:left}
.rx-medicines .rx-dose{text-align:center;width:15%;font-size:16px}.rx-medicine-name{display:flex;align-items:center;gap:6px;min-width:0}
.rx-sheet .rx-remove{flex:0 0 22px;width:22px;height:22px;padding:0;border:0;border-radius:4px;background:#fff0ef;color:#a84a4a;cursor:pointer;font-size:18px}
.rx-dose input{width:16px;height:16px;accent-color:#20284e;cursor:pointer}
.rx-instructions{margin-top:12px;border:1px solid #8c919b}.rx-instructions .rx-section-title{border:0;border-bottom:1px solid #8c919b}
.rx-instructions p{min-height:48px;margin:0;padding:10px;font-size:11px;color:#354051}
.rx-signature{display:grid;grid-template-columns:1fr 1fr;border:1px solid #8c919b;border-top:0}
.rx-signature>div{min-height:64px;padding:10px;font-size:11px}.rx-signature>div+div{border-left:1px solid #8c919b}
.rx-signature strong{display:block;font-size:10px;margin-bottom:6px}.rx-signature small{display:block;font-size:9px;color:#667080}
.rx-footer{margin-top:12px;padding-top:8px;border-top:1px solid #d9dce2;text-align:center;color:#747b86;font-size:9px}
@media screen and (max-width:600px){.rx-editor .rx-masthead{grid-template-columns:1fr 60px;gap:10px}.rx-editor .rx-logo{width:60px;height:60px}.rx-editor .rx-clinic{grid-column:1/-1;text-align:left}.rx-editor .rx-patient-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rx-editor .rx-cell{grid-column:span 1!important}.rx-editor .rx-cell.rx-wide{grid-column:1/-1!important}.rx-editor .rx-doctor-details{grid-template-columns:1fr}.rx-editor .rx-doctor-details div+div{border-left:0;border-top:1px solid #8c919b}.rx-editor .rx-signature{grid-template-columns:1fr}.rx-editor .rx-signature>div+div{border-left:0;border-top:1px solid #8c919b}}
`;

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function prescriptionDateTime(issuedAt: string, part: 'date' | 'time'): string {
  const date = new Date(issuedAt);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return part === 'date'
    ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function prescriptionHeader(baseUrl: string): string {
  const logo = escapeHtml(new URL('assets/images/urocare-logo.svg', baseUrl).href);
  return `<header class="rx-masthead">
    <div class="rx-doctor"><strong>Dr. Tanveer ul Haq</strong><span>M.B.B.S, F.C.P.S (Urology)</span><span>Senior Consultant – Urology</span><span>Multan Institute of Kidney Diseases</span></div>
    <img class="rx-logo" src="${logo}" alt="UROCARE kidney emblem" width="82" height="82">
    <div class="rx-clinic"><div class="rx-bismillah" lang="ar">بسم الله الرحمن الرحيم</div><strong>Haq Medical Center</strong><span>Patient care &amp; urology</span></div>
  </header><h1 class="rx-title">Prescription</h1>
  <div class="rx-section-title">Doctor’s information</div>
  <div class="rx-doctor-details"><div><b>PHC Reg #:</b> 290710</div><div><b>Phone:</b> 0300-1234567</div></div>`;
}

/** The preview and print use this same escaped, read-only document. */
export function buildPrescriptionDocument(record: PrescriptionRecord, baseUrl: string): string {
  const fields = PRESCRIPTION_FIELDS.map(field => {
    const value = field.key === 'date' || field.key === 'time'
      ? prescriptionDateTime(record.issuedAt, field.key) : record.patient[field.key];
    return `<div class="rx-cell rx-span-${field.span || 1}"><span class="rx-cell-label">${field.label}</span><span class="rx-cell-value">${escapeHtml(value)}</span></div>`;
  }).join('');
  const medicines = record.medicines.map(medicine => `<tr><td>${escapeHtml(medicine.name)}</td><td class="rx-dose">${medicine.morning ? '✓' : ''}</td><td class="rx-dose">${medicine.afternoon ? '✓' : ''}</td><td class="rx-dose">${medicine.evening ? '✓' : ''}</td></tr>`).join('');
  const blanks = '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'.repeat(Math.max(0, 8 - record.medicines.length));
  return `<article class="rx-sheet">${prescriptionHeader(baseUrl)}
    <div class="rx-section-title">Patient’s information</div><div class="rx-patient-grid">${fields}</div>
    <div class="rx-section-title">Prescription (Rx)</div><table class="rx-medicines"><thead><tr><th>Medicine / dose</th><th>Morning</th><th>Afternoon</th><th>Evening</th></tr></thead><tbody>${medicines}${blanks}</tbody></table>
    <section class="rx-instructions"><div class="rx-section-title">Instructions</div><p>${PRESCRIPTION_INSTRUCTIONS}</p></section>
    <div class="rx-signature"><div><strong>Doctor’s name and signature</strong>Dr. Tanveer ul Haq<small>Senior Consultant Urologist</small></div><div><strong>Date &amp; time</strong>${escapeHtml(prescriptionDateTime(record.issuedAt, 'date'))} · ${escapeHtml(prescriptionDateTime(record.issuedAt, 'time'))}</div></div>
    <div class="rx-footer">Haq Medical Center · Multan Institute of Kidney Diseases</div>
  </article>`;
}
