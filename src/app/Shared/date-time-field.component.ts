import { CommonModule } from '@angular/common';
import { Component, DoCheck, forwardRef, InjectFlags, Injector, Input, OnChanges, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, NgControl, ValidationErrors, Validator } from '@angular/forms';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { TimePickerComponent } from './time-picker.component';
import { calendarDate, calendarValue, clockDisplay, clockValue } from './date-time-values';

@Component({
  selector: 'app-date-time-field', standalone: true,
  imports: [CommonModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, MatButtonModule, MatIconModule, MatDialogModule],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimeFieldComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateTimeFieldComponent), multi: true },
    { provide: MAT_DATE_FORMATS, useValue: { parse: { dateInput: null }, display: { dateInput: { day: '2-digit', month: 'short', year: 'numeric' }, monthYearLabel: { month: 'short', year: 'numeric' }, dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' }, monthYearA11yLabel: { month: 'long', year: 'numeric' } } } },
  ],
  templateUrl: './date-time-field.component.html', styleUrls: ['./date-time-field.component.css'],
})
export class DateTimeFieldComponent implements ControlValueAccessor, Validator, OnInit, OnChanges, OnDestroy, DoCheck {
  @Input() label = 'Date';
  @Input() kind: 'date' | 'time' | 'datetime' = 'date';
  @Input() required = false;
  @Input() min: string | Date | null = null;
  @Input() max: string | Date | null = null;
  @Input() hint = '';
  @Input() emptyValue: null | string = '';
  @ViewChild(MatDatepicker) calendar?: MatDatepicker<Date>;
  @ViewChildren(MatInput) inputs?: QueryList<MatInput>;
  date: Date | null = null; time = ''; disabled = false;
  private invalidValue = false;
  private control?: NgControl;
  private change: (value: string | null) => void = () => {};
  private touched: () => void = () => {};
  private validatorChange: () => void = () => {};
  private timeDialog?: MatDialogRef<TimePickerComponent>;
  private closing?: Subscription;
  readonly matcher = { isErrorState: () => !!this.control?.control?.invalid && !!this.control.control.touched };
  constructor(private injector: Injector, private dialog: MatDialog) {}
  ngOnInit(): void { this.control = this.injector.get(NgControl, undefined, InjectFlags.Self | InjectFlags.Optional); }
  ngOnChanges(): void { this.validatorChange(); }
  // The visible inputs belong to one outer form control. Material cannot automatically
  // inspect that control, so mirror its touched/error state into the inner fields.
  ngDoCheck(): void { this.inputs?.forEach(input => input.updateErrorState()); }
  ngOnDestroy(): void { this.closing?.unsubscribe(); this.timeDialog?.close(); this.calendar?.close(); }
  get minDate(): Date | null { return calendarDate(this.min); }
  get maxDate(): Date | null { return calendarDate(this.max); }
  get displayTime(): string { return clockDisplay(this.time); }
  get errorText(): string { if (this.kind === 'datetime' && (!!this.date !== !!this.time)) return 'Select both a date and time'; if (this.date && this.minDate && this.date < this.minDate) return 'Select a date on or after ' + calendarValue(this.minDate); if (this.date && this.maxDate && this.date > this.maxDate) return 'Select a date on or before ' + calendarValue(this.maxDate); return 'Select a valid ' + (this.kind === 'datetime' ? 'date and time' : this.kind); }
  writeValue(value: unknown): void {
    this.invalidValue = false; this.date = null; this.time = '';
    if (value == null || value === '') return;
    if (this.kind === 'time') { this.time = clockValue(value); this.invalidValue = !this.time; }
    else if (this.kind === 'date') { this.date = calendarDate(value); this.invalidValue = !this.date; }
    else {
      const parsed = value instanceof Date ? value : typeof value === 'string' && calendarDate(value) ? new Date(value) : null;
      if (parsed && Number.isFinite(parsed.getTime())) { this.date = calendarDate(parsed); this.time = String(parsed.getHours()).padStart(2, '0') + ':' + String(parsed.getMinutes()).padStart(2, '0'); }
      else this.invalidValue = true;
    }
  }
  registerOnChange(fn: (value: string | null) => void): void { this.change = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.validatorChange = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; if (disabled) { this.calendar?.close(); this.timeDialog?.close(); } }
  validate(control: AbstractControl): ValidationErrors | null {
    if (this.invalidValue) return { dateTime: true };
    if (this.kind === 'datetime' && (!!this.date !== !!this.time)) return { dateTimeIncomplete: true };
    if (this.required && !control.value) return { required: true };
    if (this.date && this.minDate && this.date < this.minDate) return { dateMin: true };
    if (this.date && this.maxDate && this.date > this.maxDate) return { dateMax: true };
    return null;
  }
  touch(): void { this.touched(); }
  selectDate(date: Date | null): void { if (this.disabled) return; this.date = calendarDate(date); this.commit(); }
  clearDate(): void { if (this.disabled) return; this.date = null; if (this.kind === 'datetime') this.time = ''; this.commit(); }
  clearTime(): void { if (this.disabled) return; this.time = ''; if (this.kind === 'datetime') this.date = null; this.commit(); }
  openDate(event?: Event): void { if (!this.disabled) { event?.preventDefault(); this.calendar?.open(); } }
  openTime(event?: Event): void {
    if (this.disabled || this.timeDialog) return; event?.preventDefault(); this.touched();
    const ref = this.timeDialog = this.dialog.open(TimePickerComponent, { data: { value: this.time, label: this.kind === 'time' ? this.label : 'Time' }, width: '360px', maxWidth: 'calc(100vw - 28px)', panelClass: 'hmc-dialog-panel', autoFocus: 'first-tabbable', restoreFocus: true });
    this.closing = ref.afterClosed().subscribe(value => { this.timeDialog = undefined; if (value !== undefined && !this.disabled) { this.time = clockValue(value); if (!this.time && this.kind === 'datetime') this.date = null; this.commit(); } });
  }
  private commit(): void { this.invalidValue = false; const value = this.kind === 'time' ? this.time : this.kind === 'date' ? this.date ? calendarValue(this.date) : '' : this.date && this.time ? calendarValue(this.date) + 'T' + this.time : ''; this.change(value || this.emptyValue); this.touched(); this.validatorChange(); }
}
