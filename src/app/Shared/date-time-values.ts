import { AbstractControl, ValidationErrors } from '@angular/forms';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Serialize only a user-selected timestamp. Empty values stay empty. */
export function selectedDateTime(value: unknown): string {
  if (value == null || value === '') return '';
  if (!(value instanceof Date) && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value))) throw new Error('Select a valid date and time.');
  const date = new Date(value as string | Date);
  if (!calendarDate(value) || !Number.isFinite(date.getTime())) throw new Error('Select a valid date and time.');
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : date.toISOString();
}

export function validSelectedDateTime(control: AbstractControl): ValidationErrors | null {
  try { selectedDateTime(control.value); return null; } catch { return { dateTime: true }; }
}

/** Calendar dates are local values, not UTC instants. Never serialize them through toISOString. */
export function calendarDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getFullYear(), value.getMonth(), value.getDate()) : null;
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
    return year >= 1 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    if (!calendarDate(value.slice(0, 10)) || !clockValue(value.slice(11, 16))) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? calendarDate(parsed) : null;
  }
  return null;
}
export function calendarValue(value: Date): string { return String(value.getFullYear()).padStart(4, '0') + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate()); }
export function clockValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return '';
  let hour = Number(match[1]); const minute = Number(match[2]), period = match[3]?.toUpperCase();
  if (minute > 59 || hour > (period ? 12 : 23) || (period && hour < 1)) return '';
  if (period) hour = hour % 12 + (period === 'PM' ? 12 : 0);
  return pad(hour) + ':' + pad(minute);
}
export function clockDisplay(value: string): string { const valid = clockValue(value); if (!valid) return ''; const [hour, minute] = valid.split(':').map(Number); return (hour % 12 || 12) + ':' + pad(minute) + (hour < 12 ? ' AM' : ' PM'); }
