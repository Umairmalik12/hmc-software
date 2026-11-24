import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { firstValueFrom, Subscription } from 'rxjs';
import { OtCatalogMedicine, otMedicineKey } from '../../Models/ot-medicine-catalog.model';
import { OtMedicineCatalogService } from '../../Services/ot-medicine-catalog.service';
import { ScrollPagination, trackRecord } from '../../Shared/scroll-pagination';
import { exportRecords } from '../../Shared/export-records';
import { OtMedicineEditComponent } from './ot-medicine-edit.component';
import { OtMedicineDeleteComponent } from './ot-medicine-delete.component';
import { MedicineAlphabet, trackMedicineLetter } from '../../Shared/medicine-alphabet';

@Component({ selector: 'app-ot-medicine-catalog', templateUrl: './ot-medicine-catalog.component.html', styleUrls: ['./ot-medicine-catalog.component.css', '../../Shared/medicine-catalog-layout.css'] })
export class OtMedicineCatalogComponent implements OnInit, OnDestroy {
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly trackLetter = trackMedicineLetter;
  private readonly alphabet = new MedicineAlphabet<OtCatalogMedicine>();
  readonly embedded: boolean;
  isSuperAdmin = false;
  medicines: OtCatalogMedicine[] = [];
  query = '';
  letterFilter = '';
  status = 'all';
  category = '';
  loading = false;
  deletingId = '';
  error = '';
  success = '';
  private version = 0;
  private subscriptions = new Subscription();
  constructor(private catalog: OtMedicineCatalogService, private dialog: MatDialog, @Optional() @Inject(MAT_DIALOG_DATA) data: { embedded?: boolean } | null, private feedback: NotifyUpdateService = new NotifyUpdateService()) { this.embedded = data?.embedded === true; }
  get activeCount(): number { return this.medicines.filter(item => item.active).length; }
  get categories(): string[] { return Array.from(new Set(this.medicines.map(item => item.category).filter(Boolean))).sort(); }
  get alphabetView() {
    const query = otMedicineKey(this.query);
    return this.alphabet.view(this.medicines, JSON.stringify([query, this.category, this.status]), item => (!query || otMedicineKey([item.name, item.genericName, item.strength, item.type].join(' ')).includes(query)) && (!this.category || item.category === this.category) && (this.status === 'all' || item.active === (this.status === 'active')), this.letterFilter);
  }
  get filtered(): OtCatalogMedicine[] { return this.alphabetView.items; }
  get visible(): OtCatalogMedicine[] { return this.pagination.slice(this.filtered); }
  get visibleGroups() { return this.alphabet.visibleGroups(this.alphabetView, this.pagination.limit); }
  onFilterChange(): void { this.pagination.reset(); }
  selectLetter(letter: string): void { this.letterFilter = letter === 'all' ? '' : letter; this.onFilterChange(); }
  clearFilters(): void { this.query = ''; this.letterFilter = ''; this.category = ''; this.status = 'all'; this.onFilterChange(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  ngOnInit(): void { void this.load(); this.subscriptions.add(this.catalog.changes.subscribe(() => void this.load())); }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); this.version++; }
  async load(refresh = false): Promise<void> {
    const version = ++this.version; this.loading = true; this.isSuperAdmin = false;
    try { const [rows, admin] = await Promise.all([this.catalog.getAll(false, refresh), this.catalog.canManage()]); if (version === this.version) { this.medicines = rows; this.isSuperAdmin = admin; this.error = ''; } }
    catch (error) { if (version === this.version) { this.error = error instanceof Error ? error.message : 'Unable to load OT medicines.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(medicine?: OtCatalogMedicine): void {
    if (this.loading || this.deletingId) return;
    this.success = ''; this.error = '';
    const ref = this.dialog.open(OtMedicineEditComponent, { data: { id: medicine?.id }, width: '760px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe(saved => { if (saved) { this.success = 'OT medicine saved.'; void this.load(); } }));
  }
  async delete(medicine: OtCatalogMedicine): Promise<void> {
    if (this.loading || this.deletingId) return;
    this.deletingId = medicine.id; this.success = ''; this.error = '';
    try {
      const confirmed = await firstValueFrom(this.dialog.open(OtMedicineDeleteComponent, { data: { name: medicine.name }, role: 'alertdialog', width: '520px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel', autoFocus: '[cdkFocusInitial]' }).afterClosed());
      if (confirmed !== true) return;
      await this.catalog.delete(medicine.id); this.feedback.success('OT medicine deleted successfully. Saved records are preserved.', { title: 'OT medicine deleted', route: '/ot-medicines' });
      this.success = 'OT medicine removed. Saved patient records are preserved.'; await this.load();
    } catch (error) { this.error = error instanceof Error ? error.message : 'Unable to remove this medicine.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.deletingId = ''; }
  }
  addStrength(medicine: OtCatalogMedicine): void {
    if (this.deletingId) return;
    this.success = ''; this.error = '';
    const ref = this.dialog.open(OtMedicineEditComponent, { data: { fromId: medicine.id }, width: '760px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe(saved => { if (saved) { this.success = 'OT medicine strength saved.'; void this.load(); } }));
  }
  export(): void { exportRecords(this.filtered.map(item => ({ Medicine: item.name, Generic: item.genericName, Category: item.category, Type: item.type, Strength: item.strength, Unit: item.unit, Description: item.description, Status: item.active ? 'Active' : 'Inactive' })), 'ot-medicines.xlsx', 'OT medicines', this.feedback); }
}
