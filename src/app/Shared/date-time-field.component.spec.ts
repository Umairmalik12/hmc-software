import { ApplicationRef, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { DateTimeFieldComponent } from './date-time-field.component';
import { TimePickerComponent } from './time-picker.component';
import { calendarDate, calendarValue, clockDisplay, clockValue } from './date-time-values';

@Component({ template: `<div class="picker-test-grid" [formGroup]="form"><app-date-time-field label="From" formControlName="date" [required]="true"></app-date-time-field><app-date-time-field label="To" formControlName="to" [min]="form.controls.date.value"></app-date-time-field><app-date-time-field label="Duty starts" kind="time" formControlName="time"></app-date-time-field><app-date-time-field class="combined-test" label="Test" kind="datetime" formControlName="datetime"></app-date-time-field></div><app-date-time-field label="History filter" [(ngModel)]="filter"></app-date-time-field>`, styles: [`.picker-test-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.combined-test{grid-column:1/-1}@media(max-width:520px){.picker-test-grid{grid-template-columns:minmax(0,1fr)}}`] })
class DateTimeHost {
  form = new FormGroup({ date: new FormControl('2026-11-22', Validators.required), to: new FormControl('2026-11-24'), time: new FormControl('00:05'), datetime: new FormControl('2026-11-22T23:59') });
  filter = '';
}

describe('Shared calendar and time pickers', () => {
  let fixture: ComponentFixture<DateTimeHost>;
  const tick = async () => { fixture.detectChanges(); TestBed.inject(ApplicationRef).tick(); await new Promise(resolve => setTimeout(resolve, 30)); fixture.detectChanges(); TestBed.inject(ApplicationRef).tick(); };
  const fields = () => fixture.debugElement.queryAll(By.directive(DateTimeFieldComponent)).map(field => field.componentInstance as DateTimeFieldComponent);
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateTimeFieldComponent, FormsModule, ReactiveFormsModule, NoopAnimationsModule, MatDialogModule], declarations: [DateTimeHost] }).compileComponents();
    fixture = TestBed.createComponent(DateTimeHost); await tick();
  });
  afterEach(() => { TestBed.inject(MatDialog).closeAll(); fixture.destroy(); });
  it('opens a real calendar from the input, selects a date and emits the original date-only format', async () => {
    const root: HTMLElement = fixture.nativeElement, input = root.querySelector<HTMLInputElement>('[aria-label="From"]')!;
    expect(input.readOnly).toBeTrue(); input.click(); await tick();
    expect(document.querySelector('mat-calendar')).not.toBeNull();
    Array.from(document.querySelectorAll<HTMLButtonElement>('mat-calendar button.mat-calendar-body-cell')).find(button => button.textContent?.trim() === '23')!.click(); await tick();
    expect(fixture.componentInstance.form.controls.date.value).toBe('2026-11-23'); expect(fixture.componentInstance.form.controls.date.dirty).toBeTrue(); expect(fixture.componentInstance.form.controls.date.touched).toBeTrue(); expect(document.querySelector('mat-calendar')).toBeNull();
  });
  it('keeps date filters as strings and revalidates dependent minimum dates', async () => {
    fields()[0].selectDate(new Date(2026, 10, 25)); await tick();
    expect(fixture.componentInstance.form.controls.to.hasError('dateMin')).toBeTrue();
    fields()[1].openDate(); await tick(); const disabled = Array.from(document.querySelectorAll<HTMLButtonElement>('mat-calendar button.mat-calendar-body-cell')).find(button => button.textContent?.trim() === '24')!;
    expect(disabled.getAttribute('aria-disabled')).toBe('true'); disabled.click(); expect(fixture.componentInstance.form.controls.to.value).toBe('2026-11-24'); fields()[1].calendar!.close(); fields()[1].selectDate(new Date(2026, 10, 26)); await tick(); expect(fixture.componentInstance.form.controls.to.valid).toBeTrue();
    fields()[4].selectDate(new Date(2026, 0, 2)); await tick(); expect(fixture.componentInstance.filter).toBe('2026-01-02'); fields()[4].clearDate(); await tick(); expect(fixture.componentInstance.filter).toBe('');
  });
  it('opens the time picker, saves AM/PM correctly and cancels without modifying the saved time', async () => {
    const field = fields()[2]; field.openTime(); await tick(); const dialog = TestBed.inject(MatDialog), picker = dialog.openDialogs[0].componentInstance as TimePickerComponent;
    expect(picker.hour).toBe('12'); expect(picker.minute).toBe('05'); expect(picker.period).toBe('AM'); picker.hour = '12'; picker.minute = '30'; picker.period = 'PM';
    TestBed.inject(ApplicationRef).tick(); const apply = Array.from(document.querySelectorAll<HTMLButtonElement>('app-time-picker button')).find(button => button.textContent?.includes('Apply'))!; apply.click(); await tick();
    expect(fixture.componentInstance.form.controls.time.value).toBe('12:30'); expect(field.displayTime).toBe('12:30 PM');
    field.openTime(); await tick(); (dialog.openDialogs[0].componentInstance as TimePickerComponent).hour = '7'; dialog.openDialogs[0].close(); await tick(); expect(fixture.componentInstance.form.controls.time.value).toBe('12:30');
    field.clearTime(); await tick(); expect(fixture.componentInstance.form.controls.time.value).toBe('');
  });
  it('preserves local date/time values and requires both parts of a combined selection', async () => {
    const field = fields()[3]; expect(field.date!.getDate()).toBe(22); expect(field.displayTime).toBe('11:59 PM');
    field.selectDate(new Date(2026, 10, 23)); await tick(); expect(fixture.componentInstance.form.controls.datetime.value).toBe('2026-11-23T23:59');
    field.clearDate(); await tick(); expect(fixture.componentInstance.form.controls.datetime.value).toBe(''); expect(field.time).toBe('');
    field.selectDate(new Date(2026, 10, 24)); await tick(); expect(fixture.componentInstance.form.controls.datetime.hasError('dateTimeIncomplete')).toBeTrue();
    field.openTime(); await tick(); TestBed.inject(MatDialog).openDialogs[0].close('00:00'); await tick(); expect(fixture.componentInstance.form.controls.datetime.value).toBe('2026-11-24T00:00'); expect(fixture.componentInstance.form.controls.datetime.valid).toBeTrue();
  });
  it('supports form reset, required errors, disabled state and nullable dates', async () => {
    const field = fields()[0]; field.clearDate(); await tick(); expect(fixture.componentInstance.form.controls.date.hasError('required')).toBeTrue(); expect(fixture.nativeElement.textContent).toContain('Select a valid date');
    fixture.componentInstance.form.controls.date.reset('2026-12-01'); await tick(); expect(field.date!.getMonth()).toBe(11); expect(fixture.componentInstance.form.controls.date.pristine).toBeTrue();
    fixture.componentInstance.form.disable(); await tick(); field.openDate(); fields()[2].openTime(); expect(document.querySelector('mat-calendar')).toBeNull(); expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0); expect(fixture.nativeElement.querySelector('input').disabled).toBeTrue();
    fixture.componentInstance.form.enable(); await tick(); field.emptyValue = null; field.clearDate(); await tick(); expect(fixture.componentInstance.form.controls.date.value).toBeNull();
  });
  it('shows invalid stored values without replacing them and never changes untouched timestamps', async () => {
    const before = fixture.componentInstance.form.getRawValue(); await tick(); expect(fixture.componentInstance.form.getRawValue()).toEqual(before);
    fixture.componentInstance.form.controls.date.setValue('2026-02-30'); await tick(); expect(fixture.componentInstance.form.controls.date.invalid).toBeTrue(); expect(fixture.componentInstance.form.controls.date.value).toBe('2026-02-30');
    fixture.componentInstance.form.controls.time.setValue('25:90'); await tick(); expect(fixture.componentInstance.form.controls.time.invalid).toBeTrue();
  });
  it('fits date, time and combined controls and the popup inside desktop and phone viewports', async () => {
    const root: HTMLElement = fixture.nativeElement; expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('app-date-time-field'))) expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    fields()[2].openTime(); await tick(); const surface = document.querySelector<HTMLElement>('.mat-mdc-dialog-surface')!, content = surface.querySelector<HTMLElement>('mat-dialog-content')!, actions = surface.querySelector<HTMLElement>('mat-dialog-actions')!;
    expect(surface.getBoundingClientRect().left).toBeGreaterThanOrEqual(0); expect(surface.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth); expect(content.scrollWidth).toBeLessThanOrEqual(content.clientWidth + 1); expect(actions.scrollWidth).toBeLessThanOrEqual(actions.clientWidth + 1);
  });
});

describe('Date and clock value compatibility', () => {
  it('round trips local dates, leap years, existing Date objects and ISO timestamps without UTC date shifts', () => {
    expect(calendarValue(calendarDate('2024-02-29')!)).toBe('2024-02-29'); expect(calendarDate('2026-02-29')).toBeNull(); expect(calendarDate('2026-13-01')).toBeNull(); expect(calendarDate('11/22/2026')).toBeNull();
    const local = new Date(2026, 10, 22, 23, 59); expect(calendarValue(calendarDate(local)!)).toBe('2026-11-22'); expect(calendarValue(calendarDate(local.toISOString())!)).toBe('2026-11-22');
  });
  it('handles midnight, noon, legacy AM/PM and invalid hours', () => {
    expect(clockValue('12:00 AM')).toBe('00:00'); expect(clockValue('12:00 PM')).toBe('12:00'); expect(clockValue('1:05 PM')).toBe('13:05'); expect(clockValue('23:59:00')).toBe('23:59'); expect(clockDisplay('00:00')).toBe('12:00 AM'); expect(clockDisplay('12:00')).toBe('12:00 PM'); expect(clockValue('24:00')).toBe(''); expect(clockValue('03:60')).toBe('');
  });
});
