import * as XLSX from 'xlsx';

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}): Record<string, unknown> {
  if (value instanceof Date) output[prefix] = value.toLocaleString();
  else if (Array.isArray(value)) output[prefix] = value.map(item => typeof item === 'object' && item !== null
    ? Object.entries(item).map(([key, part]) => key + ': ' + String(part ?? '')).join(', ')
    : String(item ?? '')).join(' | ');
  else if (value !== null && typeof value === 'object') Object.entries(value).forEach(([key, part]) => flatten(part, prefix ? prefix + '.' + key : key, output));
  else output[prefix || 'Value'] = value ?? '';
  return output;
}

/** Export exactly the supplied filtered records; nested values remain readable. */
export function exportRecords(rows: readonly unknown[], filename: string, sheetName = 'Records'): void {
  const sheet = XLSX.utils.json_to_sheet(rows.map(row => flatten(row)));
  const keys = rows.length ? Object.keys(flatten(rows[0])) : [];
  sheet['!cols'] = keys.map(key => ({ wch: Math.min(60, Math.max(14, key.length + 3)) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, filename);
}
