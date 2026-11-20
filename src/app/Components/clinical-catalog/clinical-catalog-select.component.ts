import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnDestroy, OnInit } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { ClinicalCatalogKind, ClinicalCatalogService, ClinicalOption, CLINICAL_COLLECTIONS, clinicalNameKey, sameClinicalName } from '../../Services/clinical-catalog.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { SearchableSelectComponent } from '../../Shared/searchable-select.component';

@Component({
  selector: 'app-clinical-select', standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatButtonModule, MatIconModule, SearchableSelectComponent],
  templateUrl: './clinical-catalog-select.component.html',
  styles: [':host{display:block;min-width:0}:host(.catalog-filter){flex:1 1 210px;min-width:190px}mat-form-field{width:100%}'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ClinicalCatalogSelectComponent), multi: true }],
})
export class ClinicalCatalogSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() kind: ClinicalCatalogKind = 'doctors';
  @Input() label = 'Doctor name';
  @Input() emptyLabel = 'Not specified';
  @Input() savedValues: readonly string[] = [];
  @Input() multiple = false;
  @Input() required = false;
  @Input() invalid = false;
  value: string | string[] = '';
  options: ClinicalOption[] = [];
  loading = false;
  disabled = false;
  error = '';
  readonly sameName = sameClinicalName;
  readonly errorMatcher = { isErrorState: () => this.invalid };
  changed: (value: string | string[]) => void = () => {};
  touched: () => void = () => {};
  private changes?: Subscription;
  private version = 0;
  constructor(private catalog: ClinicalCatalogService, private feedback: NotifyUpdateService) {}
  get singleValue(): string { return typeof this.value === 'string' ? this.value : ''; }
  get optionNames(): string[] {
    const names = new Map<string, string>();
    const selected = Array.isArray(this.value) ? this.value : [this.value];
    for (const name of [...selected, ...this.savedValues, ...this.options.map(option => option.name)]) {
      const key = clinicalNameKey(name); if (key && !names.has(key)) names.set(key, name);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }
  ngOnInit(): void { void this.load(); this.changes = this.catalog.changes.subscribe(collection => { if (collection === CLINICAL_COLLECTIONS[this.kind]) void this.load(); }); }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  writeValue(value: string | string[] | null): void { this.value = this.multiple ? (Array.isArray(value) ? [...value] : []) : (typeof value === 'string' ? value : ''); }
  registerOnChange(fn: (value: string | string[]) => void): void { this.changed = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }
  choose(value: string | string[]): void { this.value = value; this.changed(value); this.touched(); }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true;
    try { const options = await this.catalog.getAll(this.kind); if (version === this.version) { this.options = options; this.error = ''; } }
    catch { if (version === this.version) { this.error = 'Unable to load options. Use Retry to refresh.'; this.feedback.error(this.error); } }
    finally { if (version === this.version) this.loading = false; }
  }
}
