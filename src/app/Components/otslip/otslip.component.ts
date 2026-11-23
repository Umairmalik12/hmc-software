import { medicineVariantKey } from '../../Models/medicine-strength';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Optional, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OtMedicineItem, OtMedicineRecord, copyOtRecord, emptyOtRecord } from 'src/app/Models/ot-medicine.model';
import { OtCatalogMedicine, otMedicineKey } from 'src/app/Models/ot-medicine-catalog.model';
import { OtMedicineCatalogService } from 'src/app/Services/ot-medicine-catalog.service';
import { OtMedicineService } from 'src/app/Services/ot-medicine.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { requiredText } from 'src/app/Services/validators.service';
import { OtMedicineCatalogComponent } from '../ot-medicine-catalog/ot-medicine-catalog.component';
import { printOtMedicine } from './ot-medicine-document';
import { OtMedicinePreviewComponent } from './ot-medicine-preview.component';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';
import { replacePatientPrefill } from 'src/app/Shared/patient-lookup-form';

interface ProductRow {
  key: string;
  snapshot: OtMedicineItem;
  master?: OtCatalogMedicine;
  available: boolean;
  historical: boolean;
  originalOrder?: number;
}
interface VisibleProduct { name: string; index: number; genericName?: string; strength?: string; unit?: string; category?: string; type?: string; note: string; unavailable: boolean; }

@Component({ selector: 'app-ot-form', templateUrl: './otslip.html', styleUrls: ['./otslip.component.css'] })
export class OtFormComponent implements OnInit, OnDestroy {
  @Input() canManageMedicines = true;
  @Output() isCancelForm = new EventEmitter<boolean>();
  isEditMode = false;
  isSaving = false;
  loading = false;
  loadFailed = false;
  catalogueLoading = false;
  catalogueError = '';
  validationMessage = '';
  productSearch = '';
  productCategory = '';
  selectedOnly = false;
  selectedProductCount = 0;
  activeProductCount = 0;
  categories: string[] = [];
  visibleProducts: VisibleProduct[] = [];
  products: string[] = [];
  otForm: FormGroup;
  editingId: string | null = null;
  private rows: ProductRow[] = [];
  private currentRecord = emptyOtRecord();
  private requestedId = '';
  private ready = false;
  private version = 0;
  private catalogueVersion = 0;
  private pendingRefresh = false;
  private subscriptions = new Subscription();
  private lookupVersion = 0;
  matchedPatient = '';
  private patientPrefill: Record<string, unknown> = {};
  @Input() set selectedPatientId(value: string | number) {
    this.requestedId = String(value || '');
    if (this.ready) void this.load();
  }
  constructor(private fb: FormBuilder, private router: Router, private records: OtMedicineService,
    private notify: NotifyUpdateService, private dialog: MatDialog, private catalogue: OtMedicineCatalogService,
    @Optional() private patientLookup: PatientLookupService | null = null) {
    const record = this.currentRecord;
    this.otForm = fb.group({ mrNumber: [null, Validators.min(1)], patientName: ['', [Validators.required, requiredText]], doctorName: [''], roomNumber: [''],
      procedure: [''], operationDate: [record.operationDate], operationTime: [record.operationTime],
      includeMedicineHeader: ['withMedicine'], products: fb.array([]) });
    this.subscriptions.add(this.otForm.get('mrNumber')!.valueChanges.subscribe(value => { if (!this.requestedId) void this.lookupPatient(value); }));
  }
  get productControls(): FormArray { return this.otForm.get('products') as FormArray; }
  ngOnInit(): void {
    this.ready = true;
    this.subscriptions.add(this.catalogue.changes.subscribe(() => {
      if (this.loading || this.isSaving) this.pendingRefresh = true;
      else void this.refreshCatalogue();
    }));
    void this.load();
  }
  ngOnDestroy(): void { this.version++; this.catalogueVersion++; this.ready = false; this.subscriptions.unsubscribe(); }
  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.lookupVersion, mr = Number(value); this.matchedPatient = '';
    this.patientPrefill = replacePatientPrefill(this.otForm, this.patientPrefill, {});
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.lookupVersion || Number(this.otForm.get('mrNumber')!.value) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      this.patientPrefill = replacePatientPrefill(this.otForm, {}, { patientName: name, doctorName: patient.drName });
      this.matchedPatient = name;
    } catch { if (version === this.lookupVersion) this.matchedPatient = ''; }
  }
  private productGroup(): FormGroup {
    return this.fb.group({ selected: [false], quantity: [{ value: '', disabled: true }, [Validators.required, Validators.min(.000001)]] });
  }
  private masterSnapshot(item: OtCatalogMedicine): OtMedicineItem {
    return { name: item.name, catalogueId: item.id, genericName: item.genericName, category: item.category, type: item.type, strength: item.strength, unit: item.unit, quantity: 0 };
  }
  private appendRow(row: ProductRow): number {
    this.rows.push(row); this.products.push(row.snapshot.name); this.productControls.push(this.productGroup()); return this.rows.length - 1;
  }
  async load(): Promise<void> {
    const version = ++this.version;
    this.catalogueVersion++;
    this.loading = true; this.catalogueLoading = true; this.loadFailed = false; this.validationMessage = ''; this.catalogueError = '';
    const [recordResult, catalogResult] = await Promise.allSettled([
      this.requestedId ? this.records.getById(this.requestedId) : Promise.resolve(emptyOtRecord()), this.catalogue.getAll(),
    ]);
    if (version !== this.version) return;
    try {
      if (recordResult.status === 'rejected') throw recordResult.reason;
      const record = recordResult.value;
      if (!record) throw new Error('This OT record could not be found. Return to the OT medicine list.');
      this.currentRecord = copyOtRecord(record); this.editingId = record.id || null; this.isEditMode = !!record.id;
      const { products, ...details } = record;
      this.otForm.patchValue(details);
      this.rows = []; this.products = []; this.productControls.clear();
      const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : [];
      catalog.filter(item => item.active).forEach(item => this.appendRow({ key: item.id, snapshot: this.masterSnapshot(item), master: item, available: true, historical: false }));
      products.forEach((product, order) => {
        const master = product.catalogueId ? catalog.find(item => item.id === product.catalogueId) : catalog.find(item => medicineVariantKey(item.name, item.strength) === medicineVariantKey(product.name, product.strength));
        let index = master ? this.rows.findIndex((row, i) => row.key === master.id && !this.productControls.at(i).get('selected')!.value) : -1;
        if (index < 0) index = this.appendRow({ key: master?.id || product.catalogueId || 'legacy:' + order, snapshot: { ...product }, master, available: !!master?.active, historical: true });
        this.rows[index] = { ...this.rows[index], snapshot: { ...product, ...(product.catalogueId || !master ? {} : { catalogueId: master.id }) }, master, historical: true, originalOrder: order };
        const group = this.productControls.at(index);
        group.get('selected')!.setValue(true); group.get('quantity')!.enable(); group.get('quantity')!.setValue(product.quantity);
      });
      if (catalogResult.status === 'rejected') { this.catalogueError = 'Unable to load the OT medicine catalogue. Retry before saving.'; this.notify.error(this.catalogueError); }
      this.updateVisibleProducts(); this.otForm.markAsPristine(); this.otForm.markAsUntouched();
    } catch (error) { this.loadFailed = true; this.validationMessage = error instanceof Error ? error.message : 'Unable to load OT record.'; this.notify.error(this.validationMessage); }
    finally {
      this.loading = false; this.catalogueLoading = false;
      if (this.pendingRefresh) { this.pendingRefresh = false; void this.refreshCatalogue(); }
    }
  }
  async refreshCatalogue(): Promise<void> {
    if (this.loading || this.isSaving) { this.pendingRefresh = true; return; }
    const version = ++this.catalogueVersion; const recordVersion = this.version;
    this.catalogueLoading = true;
    try {
      const catalog = await this.catalogue.getAll(false, true);
      if (version !== this.catalogueVersion || recordVersion !== this.version) return;
      // Keep FormArray indexes stable: catalogue changes must never move quantities.
      this.rows.forEach(row => {
        const master = catalog.find(item => item.id === row.key) || (!row.snapshot.catalogueId && row.historical ? catalog.find(item => medicineVariantKey(item.name, item.strength) === medicineVariantKey(row.snapshot.name, row.snapshot.strength)) : undefined);
        row.master = master; row.available = !!master?.active;
        if (master && row.key.startsWith('legacy:')) row.key = master.id;
        if (master && !row.historical) row.snapshot = this.masterSnapshot(master);
      });
      catalog.filter(item => item.active && !this.rows.some(row => row.key === item.id)).forEach(item => this.appendRow({ key: item.id, snapshot: this.masterSnapshot(item), master: item, available: true, historical: false }));
      this.catalogueError = ''; this.updateVisibleProducts();
    } catch (error) { if (version === this.catalogueVersion) { this.catalogueError = 'Unable to refresh OT medicines. Retry before saving.'; this.notify.error(this.catalogueError); } }
    finally { if (version === this.catalogueVersion) this.catalogueLoading = false; }
  }
  updateVisibleProducts(): void {
    const query = otMedicineKey(this.productSearch);
    this.selectedProductCount = 0; this.activeProductCount = new Set(this.rows.filter(row => row.available).map(row => row.key)).size;
    this.categories = Array.from(new Set(this.rows.filter(row => row.available || row.historical).map(row => row.snapshot.category || '').filter(Boolean))).sort();
    this.products = this.rows.map(row => row.snapshot.name);
    this.visibleProducts = this.rows.map((row, index) => {
      const selected = !!this.productControls.at(index).get('selected')!.value;
      if (selected) this.selectedProductCount++;
      const item = row.snapshot;
      const fields: Array<'name' | 'genericName' | 'strength' | 'unit' | 'category' | 'type'> = ['name', 'genericName', 'strength', 'unit', 'category', 'type'];
      const changed = row.master && fields.some(key => (item[key] || '') !== (row.master![key] || ''));
      const note = row.historical ? (!row.available ? 'Saved item · inactive or removed' : changed ? 'Saved item · catalogue updated' : '') : !row.available ? 'Unavailable · remove to continue' : '';
      return { ...item, name: item.name, index, note, unavailable: !row.available, selected };
    }).filter(item => (this.rows[item.index].available || item.selected) && (!this.selectedOnly || item.selected) && (!this.productCategory || item.category === this.productCategory) && (!query || otMedicineKey([item.name, item.genericName, item.strength, item.type, item.category].join(' ')).includes(query)));
  }
  trackByProductIndex(_index: number, product: { index: number }): number { return product.index; }
  onFilterChange(): void { this.updateVisibleProducts(); }
  onProductSelectionChange(index: number, selected: boolean): void {
    const row = this.rows[index]; const group = this.productControls.at(index); const quantity = group.get('quantity')!;
    if (selected && !row.available && !row.historical) selected = false;
    group.get('selected')!.setValue(selected);
    if (selected) { quantity.enable(); if (!quantity.value) quantity.setValue(1); }
    else {
      quantity.setValue(''); quantity.disable(); row.historical = false; row.originalOrder = undefined;
      if (row.master) row.snapshot = this.masterSnapshot(row.master);
    }
    this.validationMessage = ''; this.updateVisibleProducts();
  }
  private snapshot(): OtMedicineRecord {
    const value = this.otForm.getRawValue();
    const products = this.rows.map((row, index) => ({ row, value: value.products[index], index })).filter(item => item.value.selected)
      .sort((a, b) => (a.row.originalOrder ?? this.rows.length + a.index) - (b.row.originalOrder ?? this.rows.length + b.index))
      .map(({ row, value }) => ({ ...row.snapshot, quantity: Number(value.quantity), selected: true }));
    return { ...this.currentRecord, ...value, products };
  }
  async submitForm(): Promise<void> {
    if (this.isSaving || this.loading || this.loadFailed || this.catalogueLoading || this.catalogueError) return;
    this.validationMessage = '';
    if (this.otForm.invalid) { this.otForm.markAllAsTouched(); this.validationMessage = 'Enter the patient name and a positive quantity for every selected item.'; this.notify.warning(this.validationMessage); return; }
    if (this.rows.some((row, i) => !row.available && !row.historical && this.productControls.at(i).get('selected')!.value)) { this.validationMessage = 'Remove unavailable medicines from this slip before saving.'; this.notify.warning(this.validationMessage); return; }
    const draft = this.snapshot();
    if (!draft.products.length) { this.validationMessage = 'Select at least one medicine or supply.'; this.notify.warning(this.validationMessage); return; }
    this.isSaving = true;
    const printWindow = window.open('', '_blank', 'width=900,height=850');
    if (printWindow) { printWindow.document.open(); printWindow.document.write('<!doctype html><title>Saving OT slip</title><p>Saving OT medicine slip...</p>'); printWindow.document.close(); }
    try {
      Object.assign(this.currentRecord, draft); this.currentRecord = await this.records.save(this.currentRecord);
      this.editingId = this.currentRecord.id; this.isEditMode = true;
      this.notify.success(this.requestedId ? 'OT medicine slip updated successfully.' : 'OT medicine slip saved successfully.');
      const printed = printOtMedicine(this.currentRecord, printWindow);
      await this.router.navigate(['/ot-records']);
      if (!printed) this.notify.alertNotify.next({ type: 'error', msg: 'OT slip saved. Allow pop-ups and use Print in the OT medicine list.' });
      else this.notify.info('OT medicine slip prepared for printing.', { title: 'Print requested', route: '/ot-records' });
    } catch (error) { printWindow?.close(); this.validationMessage = error instanceof Error ? error.message : 'Unable to save the OT medicine slip.'; this.notify.error(this.validationMessage); }
    finally { this.isSaving = false; if (this.pendingRefresh && this.ready) { this.pendingRefresh = false; void this.refreshCatalogue(); } }
  }
  manageMedicines(): void {
    if (!this.canManageMedicines || this.isSaving) return;
    const ref = this.dialog.open(OtMedicineCatalogComponent, { data: { embedded: true }, width: '1100px', maxWidth: '96vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe(() => void this.refreshCatalogue()));
  }
  preview(): void {
    if (this.isSaving || this.loading || this.loadFailed) return;
    this.dialog.open(OtMedicinePreviewComponent, { data: { record: this.snapshot() }, width: '940px', maxWidth: '96vw', maxHeight: '94dvh', panelClass: 'ot-preview-panel' });
  }
  cancelForm(): void { if (!this.isSaving) void this.router.navigate(['/ot-records']); }
}
