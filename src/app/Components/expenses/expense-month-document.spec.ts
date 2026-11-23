import { EXPENSE_HEADS, ExpenseRecord } from '../../Models/expense.model';
import { expenseMonthHtml } from './expense-month-document';

describe('Monthly expense date rows and category cells', () => {
  const record = (id: number, headId: string, description: string, amount: number, date = '2026-11-21'): ExpenseRecord => ({ id: String(id), headId, description, amount, date, remarks: '', location: '', deleted: false, createdAt: '', updatedAt: '' });
  const render = (records: ExpenseRecord[], year = 2026, month = 11) => new DOMParser().parseFromString(expenseMonthHtml({ records, year, month }), 'text/html');
  const numeric = (cell: Element | null) => Number(cell!.textContent!.replace(/,/g, ''));

  it('puts three home, four cleaning and two medical entries inside one date row with the original category columns', () => {
    const records = [record(1, 'home', 'Kitchen', 789), record(2, 'home', 'Gas', 500), record(3, 'home', 'Household', 25.5),
      record(4, 'cleaning', 'Floor', 900), record(5, 'cleaning', 'Washroom', 300), record(6, 'cleaning', 'Soap', 40), record(7, 'cleaning', 'Brush', 50),
      record(8, 'equipment', 'Medicine', 450), record(9, 'equipment', 'Supplies', 100)];
    const original = JSON.stringify(records), doc = render(records), day = doc.querySelector('tbody tr')!;
    expect(doc.querySelectorAll('tbody tr').length).toBe(1); expect(doc.querySelectorAll('td.date').length).toBe(1); expect(day.querySelector('.date')!.textContent).toBe('21-11-2026');
    expect(day.children.length).toBe(EXPENSE_HEADS.length + 5);
    expect(Array.from(day.querySelectorAll('td.category-entries')).map(cell => cell.getAttribute('data-head-id'))).toEqual(EXPENSE_HEADS.map(head => head.id));
    for (const [head, count] of [['home', 3], ['cleaning', 4], ['equipment', 2]] as const) expect(day.querySelectorAll('[data-head-id="' + head + '"] .expense-cell-entry').length).toBe(count);
    expect(day.querySelector('[data-head-id="home"]')!.textContent).toContain('Kitchen: 789.00'); expect(day.querySelector('[data-head-id="cleaning"]')!.textContent).toContain('Washroom: 300.00');
    expect(day.querySelector('[data-head-id="equipment"]')!.textContent).toContain('Medicine: 450.00'); expect(day.querySelector('[data-head-id="home"]')!.textContent).not.toContain('Washroom');
    expect(day.querySelectorAll('.category-entries .expense-cell-entry').length).toBe(9); expect(day.querySelector('.daily-entry-count')!.textContent).toBe('9 entries');
    expect(numeric(doc.querySelector('tfoot [data-head-id="home"]'))).toBe(1314.5); expect(numeric(doc.querySelector('tfoot [data-head-id="cleaning"]'))).toBe(1290); expect(numeric(doc.querySelector('tfoot [data-head-id="equipment"]'))).toBe(550);
    expect(numeric(day.querySelector('.total'))).toBe(3154.5); expect(doc.querySelector('tfoot')!.textContent).toContain('3,154.50'); expect(JSON.stringify(records)).toBe(original);
  });
  it('sorts dates once, keeps repeated descriptions as separate records and excludes deleted/other months from every total', () => {
    const records = [record(4, 'fuel', 'Petrol', 0.2, '2026-11-22'), record(2, 'home', 'Gas', 10.01), record(1, 'home', 'Gas', 10.01), record(3, 'fuel', 'Petrol', 0.1, '2026-11-22'),
      { ...record(5, 'fuel', 'Deleted', 999), deleted: true }, record(6, 'home', 'Previous month', 999, '2026-10-21'), record(7, 'home', 'Previous year', 999, '2025-11-21')];
    const doc = render(records), rows = Array.from(doc.querySelectorAll('tbody tr'));
    expect(rows.map(row => row.getAttribute('data-expense-date'))).toEqual(['2026-11-21', '2026-11-22']);
    expect(Array.from(rows[0].querySelectorAll('.category-entries .expense-cell-entry')).map(entry => entry.getAttribute('data-expense-id'))).toEqual(['1', '2']);
    expect(numeric(rows[0].querySelector('.total'))).toBe(20.02); expect(numeric(rows[1].querySelector('.total'))).toBe(0.3); expect(doc.querySelector('tfoot')!.textContent).toContain('20.32');
    expect(numeric(doc.querySelector('tfoot [data-head-id="fuel"]'))).toBe(0.3); expect(doc.querySelector('tbody')!.textContent).not.toContain('Deleted'); expect(doc.body.textContent).not.toContain('Previous month'); expect(doc.body.textContent).toContain('4 recorded entries');
  });
  it('retains every long entry and note without nested rows, clipped containers or unsafe HTML', () => {
    const records = Array.from({ length: 80 }, (_, index) => ({ ...record(index + 1, 'cleaning', 'LongPurposeWithoutSpaces'.repeat(12) + index, 123456.25), remarks: 'Remark ' + index, location: 'Location ' + index }));
    records[0].description = '<script>alert("bad")</script>'; records[0].remarks = '<img src=x onerror=bad>';
    const doc = render(records); expect(doc.querySelectorAll('tbody tr').length).toBe(1); expect(doc.querySelectorAll('td[data-head-id="cleaning"] .expense-cell-entry').length).toBe(80);
    expect(doc.querySelector('tbody')!.textContent).toContain('Remark 79'); expect(doc.querySelector('tbody')!.textContent).toContain('Location 79'); expect(doc.querySelector('script')).toBeNull(); expect(doc.querySelector('img')).toBeNull();
    const css = doc.querySelector('style')!.textContent!; expect(css).toContain('A4 landscape'); expect(css).toContain('width:283mm'); expect(css).toContain('font-size:9px;line-height:1.2'); expect(css).toContain('break-inside:auto'); expect(css).not.toContain('overflow:hidden'); expect(css).not.toContain('max-height');
    const printRules = css.split('@media print')[1]; expect(printRules).not.toContain('padding'); expect(printRules).not.toContain('font-size'); expect(printRules).not.toContain('line-height');
  });
  it('keeps unknown historical categories visible in the daily details without moving them into an existing category', () => {
    const doc = render([record(1, 'legacy-head', 'Legacy expense', 20), record(2, 'home', 'Gas', 30)]);
    expect(doc.querySelector('tbody .daily-entry-count')!.textContent).toContain('Legacy expense: 20.00'); expect(doc.querySelectorAll('.category-entries .expense-cell-entry').length).toBe(1); expect(numeric(doc.querySelector('tbody .total'))).toBe(50); expect(numeric(doc.querySelector('tfoot [data-head-id="home"]'))).toBe(30);
  });
  it('keeps an empty state and monthly totals when there are no matching records', () => {
    const doc = render([record(1, 'home', 'Other month', 99, '2026-10-21')]); expect(doc.querySelectorAll('tbody [data-expense-date]').length).toBe(0); expect(doc.querySelector('.empty')!.textContent).toContain('No expenses'); expect(doc.querySelector('tfoot')!.textContent).toContain('MONTH TOTAL');
    for (const cell of Array.from(doc.querySelectorAll('tfoot [data-head-id]'))) expect(numeric(cell)).toBe(0);
  });
});
