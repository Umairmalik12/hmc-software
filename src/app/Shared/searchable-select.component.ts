import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

const searchKey = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

@Component({
  selector: 'app-searchable-select', standalone: true,
  imports: [CommonModule, FormsModule, MatAutocompleteModule, MatInputModule, MatButtonModule, MatIconModule],
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.css'], encapsulation: ViewEncapsulation.None,
})
export class SearchableSelectComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() label = 'Option';
  @Input() ariaLabel = '';
  @Input() emptyLabel = 'Not specified';
  @Input() options: readonly string[] = [];
  @Input() disabled = false;
  @Input() loading = false;
  @Input() error = '';
  @Input() required = false;
  @Input() invalid = false;
  @Input() errorMessage = 'Select an option';
  @Input() set value(value: string | null) { this.selectedValue = value || ''; this.text = this.selectedValue; }
  get value(): string { return this.selectedValue; }
  @Output() valueChange = new EventEmitter<string>();
  @Output() touched = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @ViewChild('input') input?: ElementRef<HTMLInputElement>;
  @ViewChild('field', { read: ElementRef }) field?: ElementRef<HTMLElement>;
  @ViewChild(MatAutocompleteTrigger) trigger?: MatAutocompleteTrigger;
  text = '';
  panelWidth = 280;
  private selectedValue = '';
  private showAll = true;
  private closing?: Subscription;
  readonly errorMatcher = { isErrorState: () => this.invalid };
  get showEmptyOption(): boolean { return this.showAll || !this.text.trim(); }
  get filteredOptions(): string[] {
    const words = this.showAll ? [] : searchKey(this.text).split(' ').filter(Boolean);
    return this.options.filter(name => words.every(word => searchKey(name).includes(word)));
  }
  trackName(_index: number, name: string): string { return name; }
  isSelected(name: string): boolean { return searchKey(name) === searchKey(this.value); }
  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.disabled || changes.loading) && (this.disabled || this.loading)) { this.trigger?.closePanel(); this.text = this.value; this.showAll = true; }
  }
  ngAfterViewInit(): void { this.closing = this.trigger?.panelClosingActions.subscribe(event => { if (!event) this.restore(); }); }
  ngOnDestroy(): void { this.closing?.unsubscribe(); }
  type(text: string): void { if (this.disabled || this.loading) return; this.text = text; this.showAll = false; }
  focus(): void { this.showAll = true; this.sizePanel(); }
  blur(): void { if (!this.trigger?.panelOpen) this.restore(); }
  private restore(): void { this.text = this.value; this.showAll = true; this.touched.emit(); }
  private sizePanel(): void { this.panelWidth = Math.min(this.field?.nativeElement.getBoundingClientRect().width || 280, Math.max(100, window.innerWidth - 24)); }
  open(): void { if (this.disabled || this.loading) return; this.showAll = true; this.text = this.value; this.sizePanel(); this.input?.nativeElement.focus(); this.input?.nativeElement.select(); this.trigger?.openPanel(); }
  close(): void { this.trigger?.closePanel(); this.restore(); }
  clear(): void { if (this.disabled || this.loading) return; this.value = ''; this.valueChange.emit(''); this.close(); }
  select(event: MatAutocompleteSelectedEvent): void { if (this.disabled || this.loading) return; this.value = event.option.value; this.valueChange.emit(this.value); this.touched.emit(); this.showAll = true; }
  @HostListener('window:resize') resize(): void { this.close(); }
}
