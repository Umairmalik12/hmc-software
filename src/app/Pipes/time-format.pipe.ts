import { Pipe, PipeTransform } from '@angular/core';

/** Shared 12-hour display and input/storage conversion helpers. */
export function formatTime12(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3]?.toUpperCase();
    if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1))
      return text;
    if (meridiem) hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return hour12 + ':' + String(minute).padStart(2, '0') + ' ' + suffix;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const hour = date.getHours();
  return (
    (hour % 12 || 12) +
    ':' +
    String(date.getMinutes()).padStart(2, '0') +
    ' ' +
    (hour >= 12 ? 'PM' : 'AM')
  );
}

/** Converts accepted 12/24-hour input to the existing HH:mm storage format. */
export function timeToStorage(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '')
    return '';
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1))
    return null;
  if (meridiem) hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

@Pipe({ name: 'timeFormat' })
export class TimeFormatPipe implements PipeTransform {
  transform(value: unknown): string {
    return formatTime12(value);
  }
}
