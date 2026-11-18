import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, forwardRef, Input, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RoomOption, RoomService } from 'src/app/Services/room.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';

@Component({
  selector: 'app-room-select',
  template: `<mat-form-field appearance="outline"><mat-label>{{ label }}</mat-label>
    <mat-select [value]="value" [disabled]="disabled || loading" (selectionChange)="choose($event.value)" (closed)="touched()">
      <mat-option value="">{{ emptyLabel }}</mat-option>
      <mat-option *ngFor="let saved of retainedValues" [value]="saved">{{ saved }} (saved value)</mat-option>
      <mat-option *ngFor="let option of options" [value]="option.name">{{ option.name }}</mat-option>
    </mat-select>
    <button *ngIf="error" mat-icon-button matSuffix type="button" (click)="load()" aria-label="Retry loading rooms"><mat-icon>refresh</mat-icon></button>
    <mat-hint *ngIf="error" role="status">{{ error }}</mat-hint>
  </mat-form-field>`,
  styles: [':host{display:block;min-width:0}mat-form-field{width:100%}'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RoomSelectComponent), multi: true }],
})
export class RoomSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() label = 'Room / bed';
  @Input() emptyLabel = 'Not specified';
  @Input() savedValues: readonly string[] = [];
  options: RoomOption[] = [];
  value = '';
  disabled = false;
  loading = false;
  error = '';
  changed: (value: string) => void = () => {};
  touched: () => void = () => {};
  private changes?: Subscription;
  private version = 0;
  constructor(private rooms: RoomService, private db: SupabaseDataService, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  get retainedValues(): string[] {
    return [...new Set([this.value, ...this.savedValues].filter(Boolean))].filter(value => !this.options.some(option => option.name === value));
  }
  ngOnInit(): void { void this.load(); this.changes = this.db.changes.subscribe(collection => { if (collection === 'rooms') void this.load(); }); }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  writeValue(value: string | null): void { this.value = value == null ? '' : String(value); }
  registerOnChange(fn: (value: string) => void): void { this.changed = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  choose(value: string): void { this.value = value; this.changed(value); this.touched(); }
  async load(): Promise<void> {
    const version = ++this.version;
    this.loading = true;
    try { const options = await this.rooms.getAll(); if (version === this.version) { this.options = options; this.error = ''; } }
    catch { if (version === this.version) { this.error = 'Unable to load rooms and beds. Retry to refresh.'; this.feedback.error(this.error); } }
    finally { if (version === this.version) this.loading = false; }
  }
}
