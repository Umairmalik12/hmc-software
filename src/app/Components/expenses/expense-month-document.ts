import { EXPENSE_GROUPS, EXPENSE_HEADS, EXPENSE_MONTHS, ExpenseRecord, expenseCents } from '../../Models/expense.model';

export interface ExpenseMonthData { records: ExpenseRecord[]; year: number; month: number; }
export function monthExpenses(data: ExpenseMonthData): ExpenseRecord[] {
  return data.records.filter(row => !row.deleted && +row.date.slice(0, 4) === data.year && +row.date.slice(5, 7) === data.month)
    .slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** The same escaped document is used for the on-screen paper and the print window. */
export function expenseMonthHtml(data: ExpenseMonthData): string {
  const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
  const amount = (value: number): string => value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const records = monthExpenses(data), total = expenseCents(records) / 100;
  const groups = EXPENSE_GROUPS.map((group, index) => '<th class="group-' + index + '" colspan="' + EXPENSE_HEADS.filter(head => head.group === group).length + '" scope="colgroup">' + escape(group) + '</th>').join('');
  const heads = EXPENSE_HEADS.map(head => '<th scope="col">' + escape(head.name.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/^Ot /, 'OT ').replace(/Refreshments/gi, 'Refresh\u00adments').replace(/Refreshment/gi, 'Refresh\u00adment').replace(/Equipment/gi, 'Equip\u00adment').replace(/Overhead/gi, 'Over\u00adhead').replace(/Stationary/gi, 'Station\u00adary')) + '</th>').join('');
  const days = new Map<string, { entries: ExpenseRecord[]; heads: Map<string, ExpenseRecord[]> }>();
  for (const record of records) {
    let day = days.get(record.date);
    if (!day) { day = { entries: [], heads: new Map() }; days.set(record.date, day); }
    day.entries.push(record);
    const entries = day.heads.get(record.headId) || [];
    entries.push(record); day.heads.set(record.headId, entries);
  }
  const entry = (row: ExpenseRecord): string => '<div class="expense-cell-entry" data-expense-id="' + escape(row.id) + '"><span>' + escape(row.description) + ':</span> <b class="expense-entry-amount">' + amount(row.amount) + '</b></div>';
  const note = (rows: ExpenseRecord[], key: 'remarks' | 'location'): string => rows.filter(row => row[key]).map(row => '<div class="expense-cell-entry" data-expense-id="' + escape(row.id) + '">' + escape(row[key]) + '</div>').join('');
  const lines = [...days].map(([date, day]) => {
    // Preserve any historical unrecognised head in the details cell, never reassign it
    // to a current category or omit its amount from the daily/monthly total.
    const other = day.entries.filter(row => !EXPENSE_HEADS.some(head => head.id === row.headId));
    return '<tr data-expense-date="' + escape(date) + '"><td class="date">' + escape(date.split('-').reverse().join('-')) + '</td><td class="text daily-entry-count">' + day.entries.length + (day.entries.length === 1 ? ' entry' : ' entries') + other.map(entry).join('') + '</td>' +
      EXPENSE_HEADS.map(head => '<td class="category-entries" data-head-id="' + escape(head.id) + '">' + (day.heads.get(head.id) || []).map(entry).join('') + '</td>').join('') +
      '<td class="text">' + note(day.entries, 'remarks') + '</td><td class="number total">' + amount(expenseCents(day.entries) / 100) + '</td><td class="text">' + note(day.entries, 'location') + '</td></tr>';
  }).join('');
  const totals = EXPENSE_HEADS.map(head => '<td class="number" data-head-id="' + escape(head.id) + '">' + amount(expenseCents(records.filter(row => row.headId === head.id)) / 100) + '</td>').join('');
  return '<style>' + EXPENSE_DOCUMENT_CSS + '</style><section class="expense-print" lang="en">' +
    '<header class="expense-document-header"><div class="expense-brand-mark">' + HAQ_MARK + '</div><div><p class="expense-brand">HAQ MEDICAL CENTER</p><h1>Monthly expense sheet</h1><p class="expense-document-period">' + escape(EXPENSE_MONTHS[data.month - 1]) + ' ' + data.year + '</p></div><div class="expense-document-meta"><span>MONTH TOTAL &middot; PKR</span><strong>' + amount(total) + '</strong><small>' + records.length + ' recorded ' + (records.length === 1 ? 'entry' : 'entries') + '</small></div></header>' +
    '<table aria-label="Monthly expense sheet"><colgroup><col style="width:6%"><col style="width:5%">' + EXPENSE_HEADS.map(() => '<col>').join('') + '<col style="width:6%"><col style="width:7%"><col style="width:6%"></colgroup>' +
    '<thead><tr class="expense-groups"><th colspan="2">EXPENSE DETAILS</th>' + groups + '<th colspan="3">NOTES &amp; TOTAL</th></tr><tr><th scope="col">Date</th><th scope="col">Daily entries</th>' + heads + '<th scope="col">Remarks</th><th scope="col">Total expense</th><th scope="col">Place / location</th></tr></thead>' +
    '<tbody>' + (lines || '<tr><td class="empty" colspan="' + (EXPENSE_HEADS.length + 5) + '">No expenses recorded for this month.</td></tr>') + '</tbody>' +
    '<tfoot><tr><th scope="row" colspan="2">MONTH TOTAL &middot; PKR</th>' + totals + '<td></td><td class="number">' + amount(total) + '</td><td></td></tr></tfoot></table>' +
    '<footer class="expense-document-footer"><span>Haq Medical Center &middot; Expense register</span><span>Created By Umair Javed</span></footer></section>';
}

const EXPENSE_DOCUMENT_CSS = `
@page{size:A4 landscape;margin:9mm 7mm 12mm}
.expense-print,.expense-print *{box-sizing:border-box}
.expense-print{width:283mm;max-width:100%;margin:0 auto;background:#fff;font-family:Arial,sans-serif;color:#1b3640;line-height:1.25}
.expense-document-header{display:flex;align-items:center;gap:14px;margin:0 0 20px;padding:0 0 16px;border-bottom:2px solid #147d73}
.expense-brand-mark{width:46px;height:46px;flex:0 0 46px}.expense-brand-mark svg{display:block;width:100%;height:100%}
.expense-print .expense-brand{margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:1.3px;color:#147d73}
.expense-print h1{font-size:20px;line-height:1.3;margin:0 0 4px;color:#173b45}
.expense-print .expense-document-period{margin:0;font-size:12px;color:#526e79}
.expense-document-meta{margin-left:auto;min-width:150px;text-align:right;display:grid;gap:3px}
.expense-document-meta span,.expense-document-meta small{font-size:9px;color:#526e79}.expense-document-meta strong{font-size:20px;font-variant-numeric:tabular-nums}
.expense-print table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px}
.expense-print th,.expense-print td{border:1px solid #b2c5ca;padding:3px;overflow-wrap:anywhere;vertical-align:top}
.expense-print th{background:#edf3f4;text-align:center;font-weight:700;font-size:8px;line-height:1.5}
.expense-print .expense-groups th{padding:7px 3px;font-size:8px;letter-spacing:.3px;background:#dfeceb}
.expense-print .expense-groups .group-0{background:#e2edf7}.expense-print .expense-groups .group-1{background:#f9e8db}.expense-print .expense-groups .group-2{background:#e5f0df}.expense-print .expense-groups .group-3{background:#faf0d4}.expense-print .expense-groups .group-4{background:#e1eddf}.expense-print .expense-groups .group-5{background:#ebe6f2}
.expense-print .text{white-space:pre-wrap}.expense-print .date{text-align:center;white-space:nowrap;font-size:8px}
.expense-print .number{text-align:right;font-variant-numeric:tabular-nums}.expense-print td.number{overflow-wrap:anywhere}
.expense-print .category-entries{text-align:left;font-size:9px;line-height:1.2}
.expense-print .expense-cell-entry{padding:2px 0;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}
.expense-print .expense-cell-entry+.expense-cell-entry{border-top:1px dotted #d9e3e5}
.expense-print .expense-entry-amount{display:inline-block;max-width:100%;font-weight:600;font-variant-numeric:tabular-nums}
.expense-print .daily-entry-count{font-size:9px;color:#526e79}
.expense-print .total{background:#f0f6f4;font-weight:700}.expense-print tfoot th,.expense-print tfoot td{background:#dfeee8;font-weight:700;border-top:2px solid #147d73;padding-top:9px;padding-bottom:9px}
.expense-print tbody tr:nth-child(even){background:#fbfcfc}.expense-print thead{display:table-header-group}.expense-print tfoot{display:table-row-group;break-inside:avoid}.expense-print tbody tr{break-inside:auto}.expense-print .empty{text-align:center;padding:30px;font-size:11px;color:#607b85}
.expense-document-footer{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:8px;color:#607b85}
@media print{.expense-print{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

// Same vector mark as assets/images/haq-icon.svg, embedded so print windows need no image request.
const HAQ_MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="HAQ Medical Center"><rect width="64" height="64" rx="13" fill="#147d73"/><rect x="17" y="8" width="30" height="29" rx="4" fill="#fff"/><path d="M29 13h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#147d73"/><text x="32" y="55" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="1">HAQ</text></svg>';
