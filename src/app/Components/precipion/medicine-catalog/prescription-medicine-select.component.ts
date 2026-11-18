import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, ElementRef, forwardRef, HostListener, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PrescriptionMedicineCatalogService, PrescriptionMedicineOption } from 'src/app/Services/prescription-medicine-catalog.service';
import { MedicineOptionDialogComponent } from './medicine-option-dialog.component';
import { matchesMedicineSearch } from 'src/app/Models/medicine-strength';

let nextMedicinePickerId = 0;

@Component({
  selector: 'app-prescription-medicine-select',
  template: `<div class="rx-search-picker" [class.rx-search-disabled]="disabled" [class.rx-search-outline]="appearance === 'outline'" [class.rx-search-invalid]="invalid"><label *ngIf="appearance === 'outline'" class="rx-picker-label" [for]="inputId">{{ label }}<span *ngIf="required" aria-hidden="true"> *</span></label><mat-icon class="rx-search-icon">search</mat-icon>
    <input #input type="text" autocomplete="off" [id]="inputId" [value]="value" [disabled]="disabled" [attr.aria-label]="label" [attr.aria-required]="required || null" [attr.aria-invalid]="invalid || null" [attr.aria-describedby]="invalid ? inputId + '-error' : null" [matAutocomplete]="suggestions" [placeholder]="placeholder" (focus)="sizePanel()" (input)="type($any($event.target).value)" (blur)="touched()" (keydown.enter)="$event.preventDefault()">
    <button type="button" (click)="open()" [disabled]="disabled" [attr.aria-label]="'Browse ' + label"><mat-icon>expand_more</mat-icon></button>
    <mat-autocomplete #suggestions="matAutocomplete" class="rx-medicine-options" [panelWidth]="panelWidth" (optionSelected)="select($event)">
      <mat-option *ngIf="loading" disabled>Loading medicines...</mat-option>
      <mat-option *ngIf="!loading && error" disabled>Suggestions unavailable. You can enter medicine manually.</mat-option>
      <mat-option *ngFor="let option of filtered; trackBy: trackOption" [value]="option.name"><mat-icon>medication</mat-icon><span>{{ option.name }}</span></mat-option>
      <mat-option *ngIf="!loading && !error && !filtered.length" disabled>No matches. You can keep your typed medicine or dose.</mat-option>
      <mat-option *ngIf="canAdd" [value]="addValue" class="rx-add-option"><mat-icon>add_circle_outline</mat-icon>Add "{{ value.trim() }}" to catalogue</mat-option>
    </mat-autocomplete>
    </div><span *ngIf="invalid" class="rx-picker-error" [id]="inputId + '-error'" role="alert">{{ errorMessage }}</span><button *ngIf="error" type="button" class="rx-suggestion-retry" (click)="load()" [disabled]="disabled">Retry medicine suggestions</button>`,
  styles: [`app-prescription-medicine-select{display:block;flex:1;min-width:0}.rx-search-picker{display:flex;align-items:center;gap:6px;min-width:0;padding:3px 5px;border:1px solid #d4e3e6;border-radius:6px;background:#f9fcfc}.rx-search-picker:focus-within{border-color:#299183;box-shadow:0 0 0 2px #15857315;background:#fff}.rx-search-picker .rx-search-icon{width:15px;height:15px;flex:0 0 15px;font-size:15px;color:#7e9a9f}.rx-search-picker input{box-sizing:border-box;width:100%;min-width:0;padding:3px 0;border:0;outline:0;background:transparent;color:#213d4d;font:inherit}.rx-search-picker button{display:flex;align-items:center;justify-content:center;flex:0 0 23px;width:23px;height:25px;padding:0;border:0;border-radius:4px;background:transparent;color:#6c9297;cursor:pointer}.rx-search-picker button mat-icon{font-size:19px;width:19px;height:19px}.rx-search-disabled{opacity:.6}.rx-suggestion-retry{margin-top:4px;border:0;background:none;color:#267d6b;font:inherit;font-size:10px;cursor:pointer}
      .rx-search-outline{position:relative;box-sizing:border-box;min-height:56px;padding:10px 12px;gap:8px;border-radius:9px;border-color:#d7e2e7;background:#fff;font-size:13px}.rx-picker-label{position:absolute;top:-8px;left:10px;max-width:calc(100% - 24px);padding:0 4px;background:#fff;color:#6f8590;font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rx-search-invalid{border-color:#c54b48}.rx-search-invalid:focus-within{border-color:#c54b48;box-shadow:0 0 0 2px #c54b4812}.rx-search-invalid .rx-picker-label,.rx-picker-error{color:#b33e3a}.rx-picker-error{display:block;margin:4px 12px 0;font-size:11px;line-height:16px}
      .rx-medicine-options.mat-mdc-autocomplete-panel{box-sizing:border-box;max-height:300px;padding:6px;border:1px solid #d5e5e5;border-radius:10px;background:#fff;box-shadow:0 10px 35px #173a4526}.rx-medicine-options .mat-mdc-option{min-height:40px;height:auto;padding:9px 10px;border-radius:6px;color:#2f505f;font-size:12px;line-height:1.5;white-space:normal;overflow-wrap:anywhere}.rx-medicine-options .mat-mdc-option .mat-icon{width:17px;height:17px;flex:0 0 17px;margin-right:9px;font-size:17px;color:#8aa5a9}.rx-medicine-options .mat-mdc-option:hover,.rx-medicine-options .mat-mdc-option.mat-mdc-option-active{background:#eef7f3}.rx-medicine-options .rx-add-option{margin-top:5px;border-top:1px solid #e3eceb;color:#19745e}.rx-medicine-options .mdc-list-item__primary-text{min-width:0;white-space:normal;overflow-wrap:anywhere}`],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PrescriptionMedicineSelectComponent), multi: true }],
})
export class PrescriptionMedicineSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() label = 'Medicine';
  @Input() appearance: 'compact' | 'outline' = 'compact';
  @Input() placeholder = 'Search medicine or enter dose';
  @Input() required = false;
  @Input() invalid = false;
  @Input() errorMessage = 'Enter a medicine name';
  @Input() disabled = false;
  readonly inputId = 'medicine-picker-' + nextMedicinePickerId++;
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  @ViewChild(MatAutocompleteTrigger) trigger?: MatAutocompleteTrigger;
  @ViewChild(MatAutocomplete) autocomplete?: MatAutocomplete;
  panelWidth = 280;
  readonly addValue = '__rx_add_to_catalog__';
  value = '';
  options: PrescriptionMedicineOption[] = [];
  loading = false;
  error = false;
  private version = 0;
  private showAll = false;
  private subscriptions = new Subscription();
  changed: (value: string) => void = () => {};
  touched: () => void = () => {};
  constructor(private catalog: PrescriptionMedicineCatalogService, private dialog: MatDialog, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  get filtered(): PrescriptionMedicineOption[] { const query = this.showAll ? '' : this.value; return this.options.filter(option => matchesMedicineSearch(option.name, query)); }
  get canAdd(): boolean { return !this.loading && !this.error && !!this.value.trim() && this.value.trim().length <= 160 && this.filtered.length === 0; }
  trackOption(_index: number, option: PrescriptionMedicineOption): string { return option.id; }
  ngOnInit(): void { void this.load(); this.subscriptions.add(this.catalog.changes.subscribe(() => void this.load())); }
  ngOnDestroy(): void { this.version++; this.subscriptions.unsubscribe(); }
  writeValue(value: string | null): void { this.value = value || ''; }
  registerOnChange(fn: (value: string) => void): void { this.changed = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; if (disabled) this.trigger?.closePanel(); }
  type(value: string): void { if (!this.disabled) { this.showAll = false; this.value = value; this.changed(value); } }
  sizePanel(): void {
    const bounds = this.input?.nativeElement.getBoundingClientRect();
    if (!bounds || !this.autocomplete) return;
    const width = Math.max(120, Math.min(420, Math.max(window.innerWidth - bounds.left - 16, bounds.right - 16)));
    if (width !== this.panelWidth) {
      this.panelWidth = width; this.autocomplete.panelWidth = width;
      if (this.trigger?.panelOpen) { this.trigger.closePanel(); this.trigger.openPanel(); }
    }
  }
  @HostListener('window:resize') closeOnResize(): void { this.trigger?.closePanel(); }
  open(): void { if (!this.disabled) { this.showAll = true; this.sizePanel(); this.input?.nativeElement.focus(); this.trigger?.openPanel(); } }
  select(event: MatAutocompleteSelectedEvent): void {
    if (this.disabled) { if (this.input) this.input.nativeElement.value = this.value; return; }
    this.showAll = false;
    if (event.option.value !== this.addValue) { this.value = event.option.value; this.changed(this.value); this.touched(); return; }
    if (this.input) this.input.nativeElement.value = this.value;
    const ref = this.dialog.open(MedicineOptionDialogComponent, { data: { name: this.value.trim() }, width: '560px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe((option?: PrescriptionMedicineOption) => {
      if (option) { this.value = option.name; this.changed(option.name); this.touched(); void this.load(); }
    }));
  }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true;
    try { const options = await this.catalog.getAll(); if (version === this.version) { this.options = options; this.error = false; } }
    catch { if (version === this.version) { this.error = true; this.feedback.error('Unable to load the medicine catalogue. Retry to refresh.'); } }
    finally { if (version === this.version) this.loading = false; }
  }
}
