import * as XLSX from 'xlsx';
import { ExpenseRecord } from '../../Models/expense.model';
import { buildExpenseWorkbook } from './expense-workbook';
import { expenseMonthHtml } from './expense-month-preview.component';

export const expenseFixture = (i: number, overrides: Partial<ExpenseRecord> = {}): ExpenseRecord => ({ id: String(i), date: '2026-11-20', description: 'Expense ' + i, headId: 'fuel', amount: 10.25, remarks: 'Receipt ' + i, location: 'Multan', deleted: false, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z', ...overrides });
describe('Expense workbook export and monthly printing', () => {
  let bytes: Uint8Array, book: XLSX.WorkBook;
  const rows = Array.from({ length: 65 }, (_, i) => expenseFixture(i + 1));
  beforeAll(() => {
    bytes = buildExpenseWorkbook([...rows, expenseFixture(66, { date: '2028-02-29', headId: 'equipment', amount: 200 }), expenseFixture(67, { deleted: true, amount: 999 }), expenseFixture(68, { date: '2025-12-31', description: '=HYPERLINK("bad")', amount: 100 })], 2026, 11);
    book = XLSX.read(bytes, { type: 'array', cellStyles: true });
  });
  function xml(path: string): string { const zip = XLSX.CFB.read(bytes, { type: 'buffer' }); return new TextDecoder().decode(zip.FileIndex[zip.FullPaths.indexOf('Root Entry/' + path)].content); }
  it('exports all saved rows beyond pagination and 45 lines, keeps text as text, excludes deleted expenses and preserves location', () => {
    expect(book.SheetNames).toContain('2025'); expect(book.SheetNames).toContain('Head Summary');
    const print = book.Sheets['Print Month']; expect(print['B69'].v).toBe('Expense 9'); // IDs sort lexically within the day.
    expect(print['R70'].v).toBe(666.25); expect(print['B70'].v).toBe('MONTH TOTAL'); expect(print['S5'].v).toBe('Multan');
    expect(print['V2'].v).toBe(65); expect(print['B2'].v).toBe('November'); expect(print['E2'].v).toBe(2026);
    const annual = XLSX.utils.sheet_to_json<any[]>(book.Sheets['2025'], { header: 1 }); const literal = annual.flat().find(value => value === '=HYPERLINK("bad")'); expect(literal).toBe('=HYPERLINK("bad")');
    const cell = Object.values(book.Sheets['2025']).find(value => value?.v === '=HYPERLINK("bad")'); expect(cell.t).toBe('s'); expect(cell.f).toBeUndefined();
    expect(book.Sheets['Overall Summary']['B6'].v).toBe(666.25);
  });
  it('includes a real leap day, exact summary totals and year-specific weekly boundaries', () => {
    const annual = book.Sheets['2028']; const dateCell = Object.values(annual).find(value => value?.w === '29-Feb-2028'); expect(dateCell).toBeTruthy();
    expect(book.Sheets['Monthly Summary']['P15'].v).toBe(666.25); expect(book.Sheets['Monthly Summary']['P17'].v).toBe(666.25);
    expect(book.Sheets['Head Summary']['I15'].v).toBe(766.25); // Fuel across 2025 and 2026.
    expect(book.Sheets['Weekly Summary']['R5'].f).toContain("'Expense Data'!$T$2"); expect(book.Sheets['Weekly Summary']['R5'].f).toContain('$B$2');
  });
  it('writes valid XML parts with formatted headers, dropdown selectors, print titles and an expanding landscape print area', () => {
    const workbook = xml('xl/workbook.xml'); const sheetIndex = book.SheetNames.indexOf('Print Month') + 1;
    const print = xml('xl/worksheets/sheet' + sheetIndex + '.xml');
    expect(new DOMParser().parseFromString(workbook, 'application/xml').querySelector('parsererror')).toBeNull();
    expect(new DOMParser().parseFromString(print, 'application/xml').querySelector('parsererror')).toBeNull();
    expect(print).toContain('orientation="landscape"'); expect(print).toContain('fitToHeight="0"'); expect(print).toContain('sqref="B2"'); expect(print).toContain('sqref="E2"'); expect(print).toContain('ExpenseMonths'); expect(print).toContain('state="frozen"');
    expect(workbook).toContain('OFFSET('); expect(workbook).toContain('$V$2+5,19)'); expect(workbook).toContain('fullCalcOnLoad="1"'); expect(workbook).toContain('_xlnm.Print_Titles');
    expect(book.Workbook!.Sheets!.find(sheet => sheet.name === 'Expense Data')!.Hidden).toBe(1);
    expect(book.Sheets['Print Month']['R5'].z).toContain('#,##0.00'); expect(xml('xl/styles.xml')).toContain('FFF2B3');
    expect(book.Sheets['Print Month']['T5'].f).toContain('MATCH('); expect(book.Sheets['Print Month']['T5'].f).toContain("'Expense Data'!$W$2"); expect(book.Sheets['Expense Data']['R2'].f).toContain("'2025'!");
  });
  it('escapes untrusted text and prints every monthly entry and complete totals without fixed height clipping', () => {
    const html = expenseMonthHtml({ records: [...rows, expenseFixture(66, { description: '<script>alert(1)</script>', location: '<img onerror=bad>' }), expenseFixture(67, { date: '2026-10-01' }), expenseFixture(68, { deleted: true })], year: 2026, month: 11 });
    const parsed = new DOMParser().parseFromString(html, 'text/html'); expect(parsed.querySelector('script')).toBeNull(); expect(parsed.querySelector('img')).toBeNull();
    expect(parsed.querySelectorAll('tbody tr').length).toBe(66); expect(parsed.body.textContent).toContain('676.50'); expect(parsed.body.textContent).toContain('Expense 65'); expect(html).toContain('A4 landscape'); expect(html).toContain('table-header-group');
  });
  it('supports an empty month without dropping the total row or limiting future year selection', () => {
    const empty = XLSX.read(buildExpenseWorkbook([], 2031, 1), { type: 'array' });
    expect(empty.SheetNames).toContain('2031'); expect(empty.Sheets['Print Month']['V2'].v).toBe(0);
    expect(empty.Sheets['Print Month']['B5'].v).toBe('MONTH TOTAL'); expect(empty.Sheets['Print Month']['R5'].v).toBe(0);
    expect(empty.Sheets['Overall Summary']['B10'].v).toBe(0);
  });
});
