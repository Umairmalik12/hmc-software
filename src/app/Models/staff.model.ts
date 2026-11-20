export type StaffEmploymentType = '' | 'permanent' | 'intern';
export interface StaffDutyAssignment { duty: string; shift: string; startTime: string; endTime: string; }
export interface StaffDraft {
  name: string;
  designation: string;
  employmentType: StaffEmploymentType;
  active: boolean;
  assignments: StaffDutyAssignment[];
}
export interface StaffRecord extends StaffDraft { id: string; createdAt: string; updatedAt: string; }

export const STAFF_DUTIES = ['OT in-charge', 'Counter / reception', 'Room / ward care', 'Patient medicines', 'OPD checking'];
export const STAFF_SHIFTS = ['Morning', 'Evening', 'Night'];
export const STAFF_DESIGNATIONS = ['OT in-charge', 'Counter staff', 'Ward assistant', 'Medicine dispenser', 'OPD assistant', 'Staff nurse', 'Technician', 'Supervisor'];
export const staffKey = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export function uniqueStaffValues(values: readonly string[]): string[] {
  const names = new Map<string, string>();
  for (const value of values) { const key = staffKey(value); if (key && !names.has(key)) names.set(key, value.trim().replace(/\s+/g, ' ')); }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
export function dutyTimingError(start: string, end: string): string {
  if (!!start !== !!end) return 'Enter both the duty start and end time.';
  if (start && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end))) return 'Enter valid duty times.';
  if (start && start === end) return 'Duty start and end times must be different.';
  return '';
}
function displayTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
}
export function formatDutyTiming(assignment: StaffDutyAssignment): string {
  const { startTime: start, endTime: end } = assignment;
  if (!start || !end || dutyTimingError(start, end)) return 'Timing not recorded';
  return displayTime(start) + ' – ' + displayTime(end) + (end < start ? ' (next day)' : '');
}
export const employmentLabel = (value: StaffEmploymentType): string => value === 'permanent' ? 'Permanent' : value === 'intern' ? 'Intern' : 'Not recorded';
