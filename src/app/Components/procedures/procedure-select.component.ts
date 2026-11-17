import { Component, forwardRef, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProcedureOption, ProcedureService } from 'src/app/Services/procedure.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';

@Component({
  selector: 'app-procedure-select',
  template: `<mat-form-field appearance="outline"><mat-label>Procedure</mat-label>
    <mat-select [value]="value" [disabled]="disabled || loading" (selectionChange)="choose($event.value)" (closed)="touched()">
      <mat-option value="">Not specified</mat-option>
      <mat-option *ngIf="hasSavedValue" [value]="value">{{ value }} (saved value)</mat-option>
      <mat-option *ngFor="let option of options" [value]="option.name">{{ option.name }}</mat-option>
    </mat-select>
    <button *ngIf="error" mat-icon-button matSuffix type="button" (click)="load()" aria-label="Retry loading procedures"><mat-icon>refresh</mat-icon></button>
    <mat-hint *ngIf="error">{{ error }}</mat-hint>
  </mat-form-field>`,
  styles: [':host{display:block;min-width:0}mat-form-field{width:100%}'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ProcedureSelectComponent), multi: true }],
})
export class ProcedureSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  options: ProcedureOption[] = [];
  value = '';
  loading = false;
  disabled = false;
  error = '';
  changed: (value: string) => void = () => {};
  touched: () => void = () => {};
  private changes?: Subscription;
  private version = 0;
  constructor(private procedures: ProcedureService, private db: SupabaseDataService) {}
  get hasSavedValue(): boolean { return !!this.value && !this.options.some(option => option.name === this.value); }
  ngOnInit(): void {
    void this.load();
    this.changes = this.db.changes.subscribe(collection => { if (collection === 'procedures') void this.load(); });
  }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  writeValue(value: string | null): void { this.value = value || ''; }
  registerOnChange(fn: (value: string) => void): void { this.changed = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  choose(value: string): void { this.value = value; this.changed(value); this.touched(); }
  async load(): Promise<void> {
    const version = ++this.version;
    this.loading = true;
    try { const options = await this.procedures.getAll(); if (version === this.version) { this.options = options; this.error = ''; } }
    catch { if (version === this.version) this.error = 'Unable to load procedures. Retry to refresh.'; }
    finally { if (version === this.version) this.loading = false; }
  }
}
