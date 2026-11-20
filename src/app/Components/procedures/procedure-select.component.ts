import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, forwardRef, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProcedureOption, ProcedureService } from 'src/app/Services/procedure.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';

@Component({
  selector: 'app-procedure-select',
  templateUrl: './procedure-select.component.html',
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
  constructor(private procedures: ProcedureService, private db: SupabaseDataService, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  get optionNames(): string[] { return [...new Set([this.value, ...this.options.map(option => option.name)].filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
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
    catch { if (version === this.version) { this.error = 'Unable to load procedures. Retry to refresh.'; this.feedback.error(this.error); } }
    finally { if (version === this.version) this.loading = false; }
  }
}
