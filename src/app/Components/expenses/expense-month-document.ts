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
  const lines = records.map(row => '<tr><td class="date">' + escape(row.date.split('-').reverse().join('-')) + '</td><td class="text">' + escape(row.description) + '</td>' + EXPENSE_HEADS.map(head => '<td class="number">' + (row.headId === head.id ? amount(row.amount) : '') + '</td>').join('') + '<td class="text">' + escape(row.remarks) + '</td><td class="number total">' + amount(row.amount) + '</td><td class="text">' + escape(row.location) + '</td></tr>').join('');
  const totals = EXPENSE_HEADS.map(head => '<td class="number">' + amount(expenseCents(records.filter(row => row.headId === head.id)) / 100) + '</td>').join('');
  return '<style>' + EXPENSE_DOCUMENT_CSS + '</style><section class="expense-print" lang="en">' +
    '<header class="expense-document-header"><div class="expense-brand-mark">' + HAQ_MARK + '</div><div><p class="expense-brand">HAQ MEDICAL CENTER</p><h1>Monthly expense sheet</h1><p class="expense-document-period">' + escape(EXPENSE_MONTHS[data.month - 1]) + ' ' + data.year + '</p></div><div class="expense-document-meta"><span>MONTH TOTAL &middot; PKR</span><strong>' + amount(total) + '</strong><small>' + records.length + ' recorded ' + (records.length === 1 ? 'entry' : 'entries') + '</small></div></header>' +
    '<table aria-label="Monthly expense sheet"><colgroup><col style="width:6%"><col style="width:12%">' + EXPENSE_HEADS.map(() => '<col>').join('') + '<col style="width:8%"><col style="width:7%"><col style="width:7%"></colgroup>' +
    '<thead><tr class="expense-groups"><th colspan="2">EXPENSE DETAILS</th>' + groups + '<th colspan="3">NOTES &amp; TOTAL</th></tr><tr><th scope="col">Date</th><th scope="col">Description / purpose</th>' + heads + '<th scope="col">Remarks</th><th scope="col">Total expense</th><th scope="col">Place / location</th></tr></thead>' +
    '<tbody>' + (lines || '<tr><td class="empty" colspan="' + (EXPENSE_HEADS.length + 5) + '">No expenses recorded for this month.</td></tr>') + '</tbody>' +
    '<tfoot><tr><th scope="row" colspan="2">MONTH TOTAL &middot; PKR</th>' + totals + '<td></td><td class="number">' + amount(total) + '</td><td></td></tr></tfoot></table>' +
    '<footer class="expense-document-footer"><span>Haq Medical Center &middot; Expense register</span><span>All amounts in PKR &middot; Deleted expenses excluded</span></footer></section>';
}

const EXPENSE_DOCUMENT_CSS = `
@page{size:A4 landscape;margin:9mm 7mm 12mm}
.expense-print,.expense-print *{box-sizing:border-box}
.expense-print{width:100%;background:#fff;font-family:Arial,sans-serif;color:#1b3640;line-height:1.45}
.expense-document-header{display:flex;align-items:center;gap:14px;margin:0 0 20px;padding:0 0 16px;border-bottom:2px solid #147d73}
.expense-brand-mark{width:46px;height:46px;flex:0 0 46px}.expense-brand-mark svg{display:block;width:100%;height:100%}
.expense-print .expense-brand{margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:1.3px;color:#147d73}
.expense-print h1{font-size:20px;line-height:1.3;margin:0 0 4px;color:#173b45}
.expense-print .expense-document-period{margin:0;font-size:12px;color:#526e79}
.expense-document-meta{margin-left:auto;min-width:150px;text-align:right;display:grid;gap:3px}
.expense-document-meta span,.expense-document-meta small{font-size:9px;color:#526e79}.expense-document-meta strong{font-size:20px;font-variant-numeric:tabular-nums}
.expense-print table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px}
.expense-print th,.expense-print td{border:1px solid #b2c5ca;padding:6px 3px;overflow-wrap:anywhere;vertical-align:top}
.expense-print th{background:#edf3f4;text-align:center;font-weight:700;font-size:8px;line-height:1.5}
.expense-print .expense-groups th{padding:7px 3px;font-size:8px;letter-spacing:.3px;background:#dfeceb}
.expense-print .expense-groups .group-0{background:#e2edf7}.expense-print .expense-groups .group-1{background:#f9e8db}.expense-print .expense-groups .group-2{background:#e5f0df}.expense-print .expense-groups .group-3{background:#faf0d4}.expense-print .expense-groups .group-4{background:#e1eddf}.expense-print .expense-groups .group-5{background:#ebe6f2}
.expense-print .text{white-space:pre-wrap}.expense-print .date{text-align:center;white-space:nowrap;font-size:8px}
.expense-print .number{text-align:right;font-variant-numeric:tabular-nums}.expense-print td.number{overflow-wrap:anywhere}
.expense-print .total{background:#f0f6f4;font-weight:700}.expense-print tfoot th,.expense-print tfoot td{background:#dfeee8;font-weight:700;border-top:2px solid #147d73;padding-top:9px;padding-bottom:9px}
.expense-print tbody tr:nth-child(even){background:#fbfcfc}.expense-print thead{display:table-header-group}.expense-print tfoot{display:table-row-group}.expense-print tr{break-inside:avoid}.expense-print .empty{text-align:center;padding:30px;font-size:11px;color:#607b85}
.expense-document-footer{display:flex;justify-content:space-between;gap:12px;margin-top:14px;font-size:8px;color:#607b85}
@media print{.expense-print{-webkit-print-color-adjust:exact;print-color-adjust:exact}.expense-print th,.expense-print td{padding-top:3px;padding-bottom:3px}}
`;

// Same vector mark as assets/images/haq-icon.svg, embedded so print windows need no image request.
const HAQ_MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="HAQ Medical Center"><rect width="64" height="64" rx="13" fill="#147d73"/><rect x="17" y="8" width="30" height="29" rx="4" fill="#fff"/><path d="M29 13h6v7h7v6h-7v7h-6v-7h-7v-6h7z" fill="#147d73"/><text x="32" y="55" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif" font-size="16" font-weight="800" letter-spacing="1">HAQ</text></svg>';
