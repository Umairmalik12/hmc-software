import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { clockValue } from './date-time-values';

@Component({
  selector: 'app-time-picker', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatSelectModule],
  template: `<h2 mat-dialog-title><mat-icon>schedule</mat-icon><span>{{ data.label || 'Select time' }}<small>Choose the hour, minute and AM / PM</small></span></h2>
    <mat-dialog-content><div class="time-preview" aria-live="polite">{{ hour }}:{{ minute }} <span>{{ period }}</span></div><div class="time-selects">
    <mat-form-field appearance="outline"><mat-label>Hour</mat-label><mat-select [(ngModel)]="hour" aria-label="Hour"><mat-option *ngFor="let option of hours" [value]="option">{{ option }}</mat-option></mat-select></mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Minute</mat-label><mat-select [(ngModel)]="minute" aria-label="Minute"><mat-option *ngFor="let option of minutes" [value]="option">{{ option }}</mat-option></mat-select></mat-form-field>
    <mat-form-field appearance="outline"><mat-label>AM / PM</mat-label><mat-select [(ngModel)]="period" aria-label="AM or PM"><mat-option value="AM">AM</mat-option><mat-option value="PM">PM</mat-option></mat-select></mat-form-field>
    </div><button mat-button type="button" (click)="now()"><mat-icon>update</mat-icon>Use current time</button></mat-dialog-content>
    <mat-dialog-actions><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-stroked-button type="button" [mat-dialog-close]="''">Clear</button><button mat-flat-button color="primary" type="button" [mat-dialog-close]="value"><mat-icon>check</mat-icon>Apply</button></mat-dialog-actions>`,
  styles: [`:host{display:flex;flex-direction:column;min-width:0}.time-preview{font-size:34px;text-align:center;font-weight:600;color:#137e72;padding:6px 0 22px;line-height:1.5}.time-preview span{font-size:17px}.time-selects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.time-selects mat-form-field{min-width:0;width:100%}:host mat-dialog-actions button{min-width:0;flex:1;padding:0 8px}:host h2[mat-dialog-title]{font-size:17px}:host h2[mat-dialog-title] small{font-size:11px}:host mat-dialog-content{padding-bottom:18px!important}`],
})
export class TimePickerComponent {
  readonly hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
  readonly minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
  hour = '12'; minute = '00'; period = 'AM';
  constructor(@Inject(MAT_DIALOG_DATA) public data: { value?: string; label?: string }) { const value = clockValue(data.value); if (value) this.set(value); else this.now(); }
  private set(value: string): void { const [hour, minute] = value.split(':').map(Number); this.hour = String(hour % 12 || 12); this.minute = String(minute).padStart(2, '0'); this.period = hour < 12 ? 'AM' : 'PM'; }
  now(): void { const date = new Date(); this.set(String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')); }
  get value(): string { return String(Number(this.hour) % 12 + (this.period === 'PM' ? 12 : 0)).padStart(2, '0') + ':' + this.minute; }
}
