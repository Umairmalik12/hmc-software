import { LabPatient } from 'src/app/Models/lab.model';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

/** Markup for the shared thermal renderer; all patient values are escaped. */
export function buildLabReceipt(lab: LabPatient): string {
  const savedDate = lab.dateTime ? new Date(lab.dateTime) : null;
  const date = savedDate && Number.isFinite(savedDate.getTime()) ? savedDate : null;
  const tests = Array.isArray(lab.testName) ? lab.testName.join(', ') : lab.testName;
  const row = (label: string, value: unknown): string =>
    `<div class="slip-row"><span class="slip-label">${label}</span><span class="slip-value">${escapeHtml(value === '' || value == null ? '—' : value)}</span></div>`;

  return `<section id="lab-slip-print" aria-label="Lab test receipt">
    <div class="slip-brand">HAQ MEDICAL CENTER</div>
    <div class="slip-hospital">Laboratory</div>
    <div class="slip-rule"></div>
    <div class="slip-title">PATIENT TEST RECEIPT</div>
    <div class="slip-rule"></div>
    ${row('MR no.', lab.mrNumber ?? lab.patientId)}
    ${row('Patient', lab.name)}
    ${row('Date', date?.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) || 'Not recorded')}
    ${row('Time', date?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || 'Not recorded')}
    ${row('Phone', lab.phone)}
    <div class="slip-rule"></div>
    ${row('Tests', tests)}
    ${row('Price', 'Rs. ' + Number(lab.price || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 }))}
    ${row('Referred by', lab.suggestedDr)}
    <div class="slip-rule"></div>
    <div class="slip-footer">Printed by HMC Software</div>
    <div class="slip-thanks">THANK YOU!</div>
  </section>`;
}
