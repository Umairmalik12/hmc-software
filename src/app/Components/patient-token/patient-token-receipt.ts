import { PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { escapeHtml } from 'src/app/Shared/escape-html';
import { formatTime12 } from 'src/app/Pipes/time-format.pipe';

/** Build the same escaped record snapshot for preview, new-token printing and reprinting. */
export function buildPatientTokenReceipt(slip: PatientTokenSlip): string {
  const row = (label: string, value: string): string => `<div class="slip-row"><span class="slip-label">${label}</span><span class="slip-value">${escapeHtml(value || 'Not recorded')}</span></div>`;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(slip.date) ? slip.date.split('-').reverse().join('-') : slip.date;
  return `<section id="patient-token-slip-print" class="patient-token-receipt" aria-label="Patient token receipt">
    <div class="slip-brand">HAQ MEDICAL CENTER</div><div class="slip-hospital">Hospital</div><div class="slip-rule"></div>
    <div class="slip-title">PATIENT TOKEN</div><div class="slip-number">${escapeHtml(slip.tokenNumber)}</div><div class="slip-rule"></div>
    ${row('Patient', slip.customerName)}${row('Date', date)}${row('Time', formatTime12(slip.time))}
    <div class="slip-rule"></div><div class="slip-footer">PLEASE WAIT FOR YOUR TURN</div><div class="slip-thanks">THANK YOU!</div>
    <div class="thermal-paper-feed" aria-hidden="true"></div></section>`;
}
