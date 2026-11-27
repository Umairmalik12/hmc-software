import { Opd } from 'src/app/Models/opd.model';
import { formatTime12 } from 'src/app/Pipes/time-format.pipe';
import { escapeHtml } from 'src/app/Shared/escape-html';

export const OPD_THERMAL_CSS = `
.opd-thermal-receipt{color:#000;background:#fff;text-align:center;overflow-wrap:anywhere;font-family:Arial,sans-serif}
.opd-thermal-receipt .slip-brand{font-size:12pt;font-weight:900;line-height:1.15;letter-spacing:.2pt}
.opd-thermal-receipt .slip-title{margin:1mm 0 2mm;padding-bottom:1.5mm;border-bottom:1.5px solid #000;font-size:8pt;font-weight:700;letter-spacing:.7pt;line-height:1.3}
.opd-thermal-receipt .slip-row{display:grid;grid-template-columns:14mm minmax(0,1fr);align-items:baseline;gap:1.5mm;margin:1mm 0;text-align:left;font-size:8pt;line-height:1.35}
.opd-thermal-receipt .slip-label{font-weight:700;text-transform:none;letter-spacing:0}
.opd-thermal-receipt .slip-value{min-width:0;text-align:right;white-space:normal;overflow-wrap:anywhere;font-weight:600}
.opd-thermal-receipt .opd-patient{margin:1.5mm 0;padding:1.5mm 0;border-top:1px dashed #000;border-bottom:1px dashed #000}
.opd-thermal-receipt .opd-patient .slip-value{font-size:9pt;font-weight:800}
.opd-thermal-receipt .slip-footer{margin-top:2mm;padding-top:1.5mm;border-top:1px dashed #000;font-size:7pt;font-weight:700;line-height:1.3}
.opd-thermal-receipt .slip-thanks{margin-top:1mm;font-size:9pt;font-weight:900;line-height:1.3}
.opd-thermal-receipt .slip-brand,.opd-thermal-receipt .slip-title,.opd-thermal-receipt .slip-footer,.opd-thermal-receipt .slip-thanks{text-align:center;white-space:normal;overflow-wrap:anywhere}
.opd-thermal-feed{height:8mm;clear:both}
`;

function displayDate(value: string): string {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return value;
  const date = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  if (value.length === 10 && (date.getFullYear() !== Number(value.slice(0, 4)) || date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8, 10)))) return value;
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

export function buildOpdThermalReceipt(opd: Opd): string {
  const row = (label: string, value: unknown, className = ''): string => `<div class="slip-row ${className}"><span class="slip-label">${escapeHtml(label)}</span><span class="slip-value">${escapeHtml(value === '' || value == null ? 'Not recorded' : value)}</span></div>`;
  return `<article class="opd-thermal-receipt"><div class="slip-brand">HAQ MEDICAL CENTER</div><div class="slip-title">OPD PATIENT SLIP</div>
    ${row('MR no.', opd.patientId)}${row('Visit no.', opd.visitNumber || 1)}${row('Date', displayDate(opd.date))}${row('Time', formatTime12(opd.time))}
    ${row('Patient', opd.patientName, 'opd-patient')}${row('Sex', opd.sex)}${row('Doctor', opd.drName)}${row('Follow-up', displayDate(opd.followUp))}
    <div class="slip-footer">PLEASE KEEP THIS SLIP</div><div class="slip-thanks">THANK YOU!</div></article>`;
}

/** A continuous roll job with a tear/feed gap between the selected receipts. */
export function buildOpdThermalPrint(opds: readonly Opd[]): string {
  return `<section id="opd-thermal-print">${opds.map(buildOpdThermalReceipt).join('<div class="opd-thermal-feed" aria-hidden="true"></div>')}</section>`;
}
