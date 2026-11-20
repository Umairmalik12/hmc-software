import * as XLSX from 'xlsx';
import { EXPENSE_HEADS, EXPENSE_GROUPS, EXPENSE_MONTHS, ExpenseRecord, expenseCents, expenseWeek } from '../../Models/expense.model';

/** Rebuild the reference layout from saved records; never copy financial values from the sample file. */
export function buildExpenseWorkbook(records: readonly ExpenseRecord[], selectedYear: number, selectedMonth: number): Uint8Array {
  const rows = records.filter(row => !row.deleted).slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const years = [...new Set([2026, 2027, 2028, 2029, 2030, selectedYear, ...rows.map(row => +row.date.slice(0, 4))])].sort((a, b) => a - b);
  const book = XLSX.utils.book_new();
  const h = EXPENSE_HEADS.length, remarks = h + 2, total = h + 3, location = h + 4, yearCol = h + 5, monthCol = h + 6;
  const col = XLSX.utils.encode_col;
  const money = (items: readonly ExpenseRecord[]): number => expenseCents(items) / 100;
  const serial = (date: string): number => Date.parse(date + 'T00:00:00Z') / 86400000 + 25569;
  const day = (value: number): string => new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
  const totalRange = (index: number, first: number, last: number): string => col(index) + first + ':' + col(index) + last;
  const names: XLSX.DefinedName[] = [];
  interface Sheet { name: string; ws: XLSX.WorkSheet; styles: Map<string, number>; totals: Set<number>; selectors: string[]; hidden?: boolean; header: number; }
  const sheets: Sheet[] = [];
  const create = (name: string, headers: string[], widths: number[], header = 4, hidden = false): Sheet => {
    const ws = XLSX.utils.aoa_to_sheet([]); const sheet: Sheet = { name, ws, styles: new Map(), totals: new Set(), selectors: [], hidden, header };
    ws['!cols'] = widths.map(wch => ({ wch })); ws['!merges'] = [];
    sheets.push(sheet); XLSX.utils.book_append_sheet(book, ws, name);
    put(sheet, 1, 0, 'HAQ MEDICAL CENTER — ' + (/^\d{4}$/.test(name) ? 'EXPENSE SHEET — ' + name : name.toUpperCase()), 5);
    ws['!merges']!.push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
    headers.forEach((text, c) => put(sheet, header, c, text, 4));
    return sheet;
  };
  function put(sheet: Sheet, r: number, c: number, value: string | number, style = 0, formula?: string): void {
    const address = col(c) + r;
    sheet.ws[address] = { t: typeof value === 'number' ? 'n' : 's', v: value, ...(formula ? { f: formula } : {}) };
    sheet.styles.set(address, style);
    const range = sheet.ws['!ref'] ? XLSX.utils.decode_range(sheet.ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    range.e.r = Math.max(range.e.r, r - 1); range.e.c = Math.max(range.e.c, c); sheet.ws['!ref'] = XLSX.utils.encode_range(range);
  }
  const formula = (sheet: Sheet, r: number, c: number, f: string, cached: number | string, style = 2): void => put(sheet, r, c, cached, style, f);
  const header = ['DATE', 'DESCRIPTION / PURPOSE', ...EXPENSE_HEADS.map(head => head.name), 'REMARKS', 'TOTAL EXPENSE', 'PLACE / LOCATION DETAILS'];
  const widths = [14, 36, ...EXPENSE_HEADS.map(() => 14), 36, 18, 26];
  function groups(sheet: Sheet): void {
    for (const [i, group] of EXPENSE_GROUPS.entries()) {
      const indices = EXPENSE_HEADS.map((head, index) => head.group === group ? index + 2 : -1).filter(index => index >= 0);
      for (const c of indices) put(sheet, 3, c, c === indices[0] ? group : '', 8 + i);
      sheet.ws['!merges']!.push({ s: { r: 2, c: indices[0] }, e: { r: 2, c: indices[indices.length - 1] } });
    }
  }
  const linkedRows: { year: number; month: number; date: string; row: number; record?: ExpenseRecord }[] = [];
  let maxMonthRows = 31;
  for (const year of years) {
    const sheet = create(String(year), header, widths); groups(sheet);
    put(sheet, 2, 0, 'Expense register · Amounts in PKR · One expense head per entry', 0);
    sheet.ws['!merges']!.push({ s: { r: 1, c: 0 }, e: { r: 1, c: location } });
    let r = 5; const monthlyTotals: number[] = [];
    for (let month = 1; month <= 12; month++) {
      put(sheet, r, 0, EXPENSE_MONTHS[month - 1] + ' ' + year, 6);
      sheet.ws['!merges']!.push({ s: { r: r - 1, c: 0 }, e: { r: r - 1, c: location } }); r++;
      const first = r;
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) {
        const date = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const entries: (ExpenseRecord | undefined)[] = rows.filter(row => row.date === date); if (!entries.length) entries.push(undefined);
        for (const entry of entries) {
          put(sheet, r, 0, serial(date), 1); put(sheet, r, 1, entry?.description || '');
          EXPENSE_HEADS.forEach((head, c) => put(sheet, r, c + 2, entry?.headId === head.id ? entry.amount : '', 2));
          put(sheet, r, remarks, entry?.remarks || ''); put(sheet, r, location, entry?.location || '');
          formula(sheet, r, total, 'SUM(' + totalRange(2, r, r).split(':')[0] + ':' + col(remarks - 1) + r + ')', entry?.amount || 0, 3);
          linkedRows.push({ year, month, date, row: r, record: entry }); r++;
        }
      }
      maxMonthRows = Math.max(maxMonthRows, r - first);
      put(sheet, r, 1, EXPENSE_MONTHS[month - 1].toUpperCase() + ' TOTAL', 6); sheet.totals.add(r);
      const matching = rows.filter(row => row.date.startsWith(year + '-' + String(month).padStart(2, '0')));
      EXPENSE_HEADS.forEach((head, c) => formula(sheet, r, c + 2, 'SUM(' + totalRange(c + 2, first, r - 1) + ')', money(matching.filter(row => row.headId === head.id)), 3));
      formula(sheet, r, total, 'SUM(' + totalRange(total, first, r - 1) + ')', money(matching), 3); monthlyTotals.push(r); r++;
    }
    put(sheet, r, 1, 'YEAR TOTAL', 6); sheet.totals.add(r);
    for (const c of [...EXPENSE_HEADS.map((_, i) => i + 2), total]) formula(sheet, r, c, 'SUM(' + monthlyTotals.map(index => col(c) + index).join(',') + ')', money(rows.filter(row => +row.date.slice(0, 4) === year && (c === total || row.headId === EXPENSE_HEADS[c - 2].id))), 3);
  }
  const sequenceCol = monthCol + 1, keyCol = monthCol + 2;
  const data = create('Expense Data', [...header, 'Year', 'Month', 'Month entry', 'Month lookup'], [...widths, 8, 8, 8, 24], 1, true);
  // Reset the title/header collision on this internal sheet: all source rows start at 2.
  const monthSequences = new Map<string, number>();
  linkedRows.forEach((source, index) => {
    const r = index + 2, ref = "'" + source.year + "'!";
    for (let c = 0; c <= location; c++) {
      const sourceCell = ref + col(c) + source.row;
      const value = c === 0 ? serial(source.date) : c === 1 ? source.record?.description || '' : c === remarks ? source.record?.remarks || '' : c === location ? source.record?.location || '' : c === total ? source.record?.amount || 0 : source.record?.headId === EXPENSE_HEADS[c - 2]?.id ? source.record.amount : 0;
      formula(data, r, c, c === 0 || (c >= 2 && c <= total && c !== remarks) ? sourceCell : 'IF(' + sourceCell + '="","",' + sourceCell + ')', value, c === 0 ? 1 : 0);
    }
    formula(data, r, yearCol, 'YEAR(A' + r + ')', source.year); formula(data, r, monthCol, 'MONTH(A' + r + ')', source.month);
    const sequenceKey = source.year + '-' + source.month;
    const sequence = source.record ? (monthSequences.get(sequenceKey) || 0) + 1 : 0;
    if (sequence) monthSequences.set(sequenceKey, sequence);
    formula(data, r, sequenceCol, 'IF(' + col(total) + r + '>0,COUNTIFS($' + col(yearCol) + '$2:' + col(yearCol) + r + ',' + col(yearCol) + r + ',$' + col(monthCol) + '$2:' + col(monthCol) + r + ',' + col(monthCol) + r + ',$' + col(total) + '$2:' + col(total) + r + ',">0"),0)', sequence);
    formula(data, r, keyCol, 'IF(' + col(total) + r + '>0,' + col(yearCol) + r + '&"-"&' + col(monthCol) + r + '&"-"&' + col(sequenceCol) + r + ',"")', sequence ? source.year + '-' + source.month + '-' + sequence : '');
  });
  data.ws['!merges'] = [];
  const last = linkedRows.length + 1;
  const range = (c: number): string => "'Expense Data'!$" + col(c) + '$2:$' + col(c) + '$' + last;
  const sum = (c: number, criteria: string[]): string => 'SUMIFS(' + range(c) + ',' + criteria.join(',') + ')';
  const count = (criteria: string[]): string => 'COUNTIFS(' + criteria.concat([range(total), '">0"']).join(',') + ')';
  const sumHeads = (sheet: Sheet, r: number, offset: number, criteria: string[], matching: ExpenseRecord[], style = 2): void => {
    EXPENSE_HEADS.forEach((head, i) => formula(sheet, r, offset + i, sum(i + 2, criteria), money(matching.filter(row => row.headId === head.id)), style));
    formula(sheet, r, offset + h, sum(total, criteria), money(matching), 3);
  };
  const selector = (sheet: Sheet, address: string, type: 'year' | 'month'): void => { sheet.selectors.push(address + ':' + type); };
  const yearSelector = (sheet: Sheet): void => { put(sheet, 2, 0, 'Year'); put(sheet, 2, 1, selectedYear, 7); selector(sheet, 'B2', 'year'); };
  const print = create('Print Month', header, widths); groups(print);
  formula(print, 1, 0, '"HAQ MEDICAL CENTER — EXPENSE SHEET — "&B2&" "&E2', 'HAQ MEDICAL CENTER — EXPENSE SHEET — ' + EXPENSE_MONTHS[selectedMonth - 1] + ' ' + selectedYear, 5);
  put(print, 2, 0, 'Month'); put(print, 2, 1, EXPENSE_MONTHS[selectedMonth - 1], 7); selector(print, 'B2', 'month');
  put(print, 2, 3, 'Year'); put(print, 2, 4, selectedYear, 7); selector(print, 'E2', 'year');
  const helper = location + 1, monthHelper = col(location + 2) + '2', countHelper = col(location + 3) + '2';
  const selected = rows.filter(row => +row.date.slice(0, 4) === selectedYear && +row.date.slice(5, 7) === selectedMonth);
  formula(print, 2, location + 2, 'MATCH($B$2,ExpenseMonths,0)', selectedMonth);
  const printCriteria = [range(yearCol), '$E$2', range(monthCol), '$' + monthHelper.replace('2', '$2')];
  formula(print, 2, location + 3, count(printCriteria), selected.length);
  formula(print, 2, 6, '"PKR · "&' + col(location + 3) + '2&" entries"', 'PKR · ' + selected.length + ' entries', 0);
  print.ws['!merges']!.push({ s: { r: 1, c: 6 }, e: { r: 1, c: location } });
  for (let n = 1; n <= maxMonthRows + 1; n++) {
    const r = n + 4, helperCell = '$' + col(helper) + r, countCell = '$' + col(location + 3) + '$2';
    const f = 'IFERROR(MATCH($E$2&"-"&$' + monthHelper.replace('2', '$2') + '&"-"&' + n + ',' + range(keyCol) + ',0),"")';
    const entry = selected[n - 1], sourceIndex = entry ? linkedRows.findIndex(source => source.record === entry) + 1 : '';
    formula(print, r, helper, f, sourceIndex);
    for (let c = 0; c <= location; c++) {
      const cached = n <= selected.length ? c === 0 ? serial(entry!.date) : c === 1 ? entry!.description : c === remarks ? entry!.remarks : c === location ? entry!.location : c === total ? entry!.amount : entry!.headId === EXPENSE_HEADS[c - 2].id ? entry!.amount : '' : n === selected.length + 1 ? c === 1 ? 'MONTH TOTAL' : c === total ? money(selected) : c >= 2 && c < remarks ? money(selected.filter(row => row.headId === EXPENSE_HEADS[c - 2].id)) : '' : '';
      const subtotal = c === 1 ? '"MONTH TOTAL"' : (c >= 2 && c < remarks) || c === total ? sum(c, printCriteria) : '""';
      const cellRange = range(c);
      const valueFormula = c === 0 || c === total ? 'INDEX(' + cellRange + ',' + helperCell + ')' : 'IF(INDEX(' + cellRange + ',' + helperCell + ')="","",INDEX(' + cellRange + ',' + helperCell + '))';
      formula(print, r, c, 'IF(' + n + '<=' + countCell + ',' + valueFormula + ',IF(' + n + '=' + countCell + '+1,' + subtotal + ',""))', cached, c === 0 ? 1 : c === total ? 3 : c >= 2 && c < remarks ? 2 : 0);
    }
  }
  print.ws['!cols'] = [...widths.map(wch => ({ wch })), ...[0, 0, 0].map(() => ({ hidden: true }))];
  names.push({ Name: '_xlnm.Print_Area', Sheet: sheets.indexOf(print), Ref: "OFFSET('Print Month'!$A$1,0,0,'Print Month'!$" + col(location + 3) + '$2+5,' + (location + 1) + ')' });
  const summaryHeaders = ['Date', ...EXPENSE_HEADS.map(head => head.name), 'TOTAL EXPENSE'];
  const daily = create('Daily Summary', summaryHeaders, [14, ...EXPENSE_HEADS.map(() => 15), 18]); yearSelector(daily);
  for (let i = 0; i < 366; i++) {
    const r = i + 5, date = day(serial(selectedYear + '-01-01') + i), matching = rows.filter(row => row.date === date && +date.slice(0, 4) === selectedYear);
    const dateF = 'IF(YEAR(DATE($B$2,1,1)+' + i + ')=$B$2,DATE($B$2,1,1)+' + i + ',"")';
    formula(daily, r, 0, dateF, +date.slice(0, 4) === selectedYear ? serial(date) : '', 1);
    EXPENSE_HEADS.forEach((head, c) => formula(daily, r, c + 1, 'IF(A' + r + '="","",' + sum(c + 2, [range(0), 'A' + r]) + ')', +date.slice(0, 4) === selectedYear ? money(matching.filter(row => row.headId === head.id)) : ''));
    formula(daily, r, h + 1, 'IF(A' + r + '="","",' + sum(total, [range(0), 'A' + r]) + ')', +date.slice(0, 4) === selectedYear ? money(matching) : '', 3);
  }
  const weekly = create('Weekly Summary', ['Week', 'Week start', 'Week end', ...EXPENSE_HEADS.map(head => head.name), 'TOTAL EXPENSE'], [10, 14, 14, ...EXPENSE_HEADS.map(() => 15), 18]); yearSelector(weekly);
  const firstWeek = serial(expenseWeek(selectedYear + '-01-01'));
  for (let i = 0; i < 54; i++) {
    const r = i + 5, start = firstWeek + i * 7, valid = start <= serial(selectedYear + '-12-31');
    formula(weekly, r, 0, 'IF(B' + r + '="","",' + (i + 1) + ')', valid ? i + 1 : '');
    formula(weekly, r, 1, 'IF(DATE($B$2,1,1)-WEEKDAY(DATE($B$2,1,1),2)+1+' + i * 7 + '>DATE($B$2,12,31),"",DATE($B$2,1,1)-WEEKDAY(DATE($B$2,1,1),2)+1+' + i * 7 + ')', valid ? start : '', 1);
    formula(weekly, r, 2, 'IF(B' + r + '="","",B' + r + '+6)', valid ? start + 6 : '', 1);
    const criteria = [range(yearCol), '$B$2', range(0), '">="&B' + r, range(0), '"<="&C' + r];
    sumHeads(weekly, r, 3, criteria, valid ? rows.filter(row => +row.date.slice(0, 4) === selectedYear && serial(row.date) >= start && serial(row.date) <= start + 6) : []);
  }
  const monthly = create('Monthly Summary', ['Month', ...EXPENSE_HEADS.map(head => head.name), 'TOTAL EXPENSE'], [16, ...EXPENSE_HEADS.map(() => 15), 18]); yearSelector(monthly);
  for (let month = 1; month <= 12; month++) {
    put(monthly, month + 4, 0, EXPENSE_MONTHS[month - 1]);
    sumHeads(monthly, month + 4, 1, [range(yearCol), '$B$2', range(monthCol), String(month)], rows.filter(row => +row.date.slice(0, 4) === selectedYear && +row.date.slice(5, 7) === month));
  }
  for (const [sheet, end, offset] of [[daily, 370, 1], [weekly, 58, 3], [monthly, 16, 1]] as [Sheet, number, number][]) {
    put(sheet, end + 1, 0, 'YEAR TOTAL', 6); sheet.totals.add(end + 1);
    for (let c = 0; c <= h; c++) formula(sheet, end + 1, offset + c, 'SUM(' + totalRange(offset + c, 5, end) + ')', money(rows.filter(row => +row.date.slice(0, 4) === selectedYear && (c === h || row.headId === EXPENSE_HEADS[c].id))), 3);
  }
  const overall = create('Overall Summary', ['Year', 'Total expense', 'Months with expense', 'No. of entries', 'Average per active month'], [14, 22, 23, 20, 26]);
  years.forEach((year, i) => {
    const r = i + 5, matching = rows.filter(row => +row.date.slice(0, 4) === year), months = new Set(matching.map(row => row.date.slice(0, 7))).size;
    put(overall, r, 0, year); formula(overall, r, 1, sum(total, [range(yearCol), 'A' + r]), money(matching));
    for (let m = 1; m <= 12; m++) formula(overall, r, m + 5, sum(total, [range(yearCol), 'A' + r, range(monthCol), String(m)]), money(matching.filter(row => +row.date.slice(5, 7) === m)));
    formula(overall, r, 2, 'COUNTIF(G' + r + ':R' + r + ',">0")', months, 0);
    formula(overall, r, 3, count([range(yearCol), 'A' + r]), matching.length, 0);
    formula(overall, r, 4, 'IFERROR(B' + r + '/C' + r + ',0)', months ? money(matching) / months : 0);
  });
  overall.ws['!cols'] = [14, 22, 23, 20, 26, 0, ...Array(12).fill(0)].map((wch, i) => ({ wch, hidden: i >= 5 }));
  const headSummary = create('Head Summary', ['Group', 'Expense head', ...years.map(String), 'All years total', '% of total'], [24, 30, ...years.map(() => 18), 20, 16]);
  EXPENSE_HEADS.forEach((head, index) => {
    const r = index + 5; put(headSummary, r, 0, head.group); put(headSummary, r, 1, head.name);
    years.forEach((year, i) => formula(headSummary, r, i + 2, sum(index + 2, [range(yearCol), String(year)]), money(rows.filter(row => +row.date.slice(0, 4) === year && row.headId === head.id))));
    formula(headSummary, r, years.length + 2, 'SUM(C' + r + ':' + col(years.length + 1) + r + ')', money(rows.filter(row => row.headId === head.id)));
    formula(headSummary, r, years.length + 3, 'IFERROR(' + col(years.length + 2) + r + '/SUM(' + totalRange(years.length + 2, 5, h + 4) + '),0)', money(rows) ? money(rows.filter(row => row.headId === head.id)) / money(rows) : 0, 14);
  });
  EXPENSE_GROUPS.forEach((group, i) => {
    const r = h + 6 + i; put(headSummary, r, 0, group + ' TOTAL', 6); headSummary.totals.add(r);
    for (let y = 0; y <= years.length; y++) formula(headSummary, r, y + 2, 'SUM(' + EXPENSE_HEADS.map((head, index) => head.group === group ? col(y + 2) + (index + 5) : '').filter(Boolean).join(',') + ')', money(rows.filter(row => EXPENSE_HEADS.find(head => head.id === row.headId)?.group === group && (y === years.length || +row.date.slice(0, 4) === years[y]))), 3);
  });
  const heads = create('Head List', ['Group', 'Expense head', 'Description'], [26, 34, 85]);
  EXPENSE_HEADS.forEach((head, i) => { put(heads, i + 5, 0, head.group); put(heads, i + 5, 1, head.name); put(heads, i + 5, 2, head.description); });
  const lists = create('Lists', ['Months', 'Years'], [16, 10], 1, true); lists.ws['!merges'] = [];
  EXPENSE_MONTHS.forEach((month, i) => put(lists, i + 2, 0, month)); years.forEach((year, i) => put(lists, i + 2, 1, year));
  names.push({ Name: 'ExpenseMonths', Ref: "'Lists'!$A$2:$A$13" }, { Name: 'ExpenseYears', Ref: "'Lists'!$B$2:$B$" + (years.length + 1) });
  const instructions = create('Instructions', ['Topic', 'How to use this workbook'], [30, 110]);
  [ ['Scope', 'All saved, non-deleted expenses are exported. List search and pagination do not limit the workbook.'],
    ['Print Month', 'Select a month in B2 and a year in E2. Excel recalculates the entries and print area. Print this worksheet in landscape.'],
    ['Year sheets', 'Calendar days are provided. Put each amount in its expense head. The row total and summaries recalculate.'],
    ['Summaries', 'Daily, weekly and monthly summaries have a year selector in B2. Weeks run Monday to Sunday, restricted to the selected year.'],
    ['Saved data', 'Edits in Excel do not update the hospital database. Edit saved expenses in the application.'],
    ['Categories', 'Staff eating, night meals and refreshments use one shared expense head.'],
  ].forEach((values, i) => values.forEach((value, c) => put(instructions, i + 5, c, value)));
  sheets.forEach((sheet, index) => {
    if (!sheet.hidden) {
      names.push({ Name: '_xlnm.Print_Titles', Sheet: index, Ref: "'" + sheet.name + "'!$1:$4" });
      if (sheet !== print) names.push({ Name: '_xlnm.Print_Area', Sheet: index, Ref: "'" + sheet.name + "'!$A$1:$" + col(sheet === overall ? 4 : XLSX.utils.decode_range(sheet.ws['!ref']!).e.c) + '$' + (XLSX.utils.decode_range(sheet.ws['!ref']!).e.r + 1) });
    }
    sheet.ws['!rows'] = Array.from({ length: XLSX.utils.decode_range(sheet.ws['!ref']!).e.r + 1 }, (_, r) => {
      if (r < 4) return { hpt: r === 0 ? 28 : r === 3 ? 54 : r === 2 ? 26 : 36 };
      let lines = 2;
      for (let c = 0; c <= XLSX.utils.decode_range(sheet.ws['!ref']!).e.c; c++) {
        const value = sheet.ws[col(c) + (r + 1)]?.v;
        if (typeof value === 'string') lines = Math.max(lines, value.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(8, (sheet.ws['!cols']?.[c]?.wch || 18) - 3))), 0));
      }
      return { hpt: Math.min(409, Math.max(36, lines * 13 + 8)) };
    });
  });
  book.Workbook = { Names: names, Sheets: sheets.map(sheet => ({ name: sheet.name, Hidden: sheet.hidden ? 1 : 0 })) };
  const zip = XLSX.CFB.read(new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true })), { type: 'buffer' });
  const replace = (path: string, transform: (xml: string) => string): void => {
    const entry = zip.FileIndex[zip.FullPaths.indexOf('Root Entry/' + path)];
    if (!entry) throw new Error('Missing workbook part: ' + path);
    entry.content = new TextEncoder().encode(transform(new TextDecoder().decode(entry.content))); entry.size = entry.content.length;
  };
  replace('xl/styles.xml', () => expenseStyles());
  sheets.forEach((sheet, index) => replace('xl/worksheets/sheet' + (index + 1) + '.xml', xml => {
    xml = xml.replace(/<c\b([^>]*)>/g, (tag, attrs: string) => {
      const address = /\br="([^"]+)"/.exec(attrs)?.[1] || '', row = +address.replace(/[A-Z]/g, '');
      const style = sheet.totals.has(row) ? 3 : sheet.styles.get(address) || 0;
      return '<c' + attrs.replace(/\s+s="[^"]*"/g, '') + ' s="' + style + '">';
    });
    xml = xml.replace(/<sheetViews>.*?<\/sheetViews>/, '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
    const setup = '<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LHAQ MEDICAL CENTER&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>';
    const validations = sheet.selectors.length ? '<dataValidations count="' + sheet.selectors.length + '">' + sheet.selectors.map(item => {
      const [address, type] = item.split(':'); return '<dataValidation type="list" allowBlank="0" showErrorMessage="1" errorTitle="Choose a value" error="Select an available ' + type + '." sqref="' + address + '"><formula1>' + (type === 'year' ? 'ExpenseYears' : 'ExpenseMonths') + '</formula1></dataValidation>';
    }).join('') + '</dataValidations>' : '';
    xml = xml.replace(/<ignoredErrors>.*?<\/ignoredErrors>/, '');
    xml = xml.replace('</worksheet>', validations + setup + '</worksheet>');
    xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    return xml;
  }));
  replace('xl/workbook.xml', xml => {
    xml = xml.replace(/<bookViews>.*?<\/bookViews>/, '');
    xml = xml.replace('<sheets>', '<bookViews><workbookView activeTab="' + sheets.indexOf(print) + '"/></bookViews><sheets>');
    return xml.replace(/<calcPr\b[^>]*\/>/, '').replace('</workbook>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
  });
  return new Uint8Array(XLSX.CFB.write(zip, { type: 'buffer', fileType: 'zip', compression: true }));
}

function expenseStyles(): string {
  const fills = ['FFFFFF', 'EAF4F2', '173B45', 'FFF2B3', 'DDEBF7', 'FCE4D6', 'E2EFDA', 'FFF2CC', 'D9EAD3', 'E4DFEC'];
  const styles = [
    [0, 0, 0, 1], [0, 165, 0, 1], [0, 164, 0, 1], [1, 164, 2, 1], [1, 0, 2, 1], [2, 0, 0, 0], [3, 0, 1, 1], [3, 0, 3, 1],
    ...fills.slice(4).map((_, i) => [3, 0, i + 4, 1]), [0, 166, 0, 1],
  ];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00);–"/><numFmt numFmtId="165" formatCode="dd-mmm-yyyy"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>' +
    '<fonts count="4"><font><sz val="10"/><name val="Calibri"/><color rgb="FF173B45"/></font><font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF173B45"/></font><font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF173B45"/></font></fonts>' +
    '<fills count="' + (fills.length + 2) + '"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' + fills.map(fill => '<fill><patternFill patternType="solid"><fgColor rgb="FF' + fill + '"/><bgColor indexed="64"/></patternFill></fill>').join('') + '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB5C7CB"/></left><right style="thin"><color rgb="FFB5C7CB"/></right><top style="thin"><color rgb="FFB5C7CB"/></top><bottom style="thin"><color rgb="FFB5C7CB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="' + styles.length + '">' + styles.map(([font, num, fill, border], i) => '<xf numFmtId="' + num + '" fontId="' + font + '" fillId="' + (fill + 2) + '" borderId="' + border + '" xfId="0" applyNumberFormat="1" applyAlignment="1" applyFill="1" applyFont="1" applyBorder="1"><alignment vertical="center" horizontal="' + (i === 2 || i === 3 || i === 14 ? 'right' : i === 1 || i === 4 || i === 5 || i >= 8 && i <= 13 ? 'center' : 'left') + '" wrapText="1"/></xf>').join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

export function downloadExpenseWorkbook(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
