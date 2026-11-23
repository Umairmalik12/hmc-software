import { FormGroup } from '@angular/forms';

/** Prefills only blank controls and clears only values that the previous MR lookup supplied. */
export function replacePatientPrefill(form: FormGroup, previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  Object.entries(previous).forEach(([path, value]) => {
    const control = form.get(path);
    if (control && control.value === value) control.setValue('', { emitEvent: false });
  });
  const applied: Record<string, unknown> = {};
  Object.entries(next).forEach(([path, value]) => {
    const control = form.get(path);
    if (control && (control.value === '' || control.value === null || control.value === undefined) && value !== '' && value !== null && value !== undefined) {
      control.setValue(value, { emitEvent: false });
      applied[path] = value;
    }
  });
  return applied;
}
