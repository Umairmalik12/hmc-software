import { FormControl, FormGroup } from '@angular/forms';
import { replacePatientPrefill } from './patient-lookup-form';

describe('patient MR form prefill', () => {
  it('replaces only previous auto-filled values and preserves user edits', () => {
    const form = new FormGroup({ patientName: new FormControl<any>(''), age: new FormControl<any>('') });
    let applied = replacePatientPrefill(form, {}, { patientName: 'Ali Khan', age: 30 });
    form.get('patientName')!.setValue('Ali K.');
    applied = replacePatientPrefill(form, applied, {});
    expect(form.get('patientName')!.value).toBe('Ali K.');
    expect(form.get('age')!.value).toBe('');
    replacePatientPrefill(form, applied, { patientName: 'Sara Khan', age: 28 });
    expect(form.get('patientName')!.value).toBe('Ali K.');
    expect(form.get('age')!.value).toBe(28);
  });
});
