import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PrescriptionMedicineCatalogService, PrescriptionMedicineOption } from 'src/app/Services/prescription-medicine-catalog.service';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { exportRecords } from 'src/app/Shared/export-records';
import { MedicineOptionDialogComponent } from './medicine-option-dialog.component';
import { matchesMedicineSearch, medicineNameParts } from 'src/app/Models/medicine-strength';
import { MedicineAlphabet, trackMedicineLetter } from 'src/app/Shared/medicine-alphabet';

@Component({
  selector: 'app-prescription-medicine-catalog',
  templateUrl: './medicine-catalog.component.html',
  styleUrls: ['./medicine-catalog.component.css', '../../../Shared/medicine-catalog-layout.css'],
})
export class MedicineCatalogComponent implements OnInit, OnDestroy {
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly medicineParts = medicineNameParts;
  readonly trackLetter = trackMedicineLetter;
  private readonly alphabet = new MedicineAlphabet<PrescriptionMedicineOption>();
  readonly embedded: boolean;
  options: PrescriptionMedicineOption[] = [];
  query = '';
  letterFilter = '';
  loading = false;
  deletingId = '';
  error = '';
  success = '';
  private version = 0;
  private subscriptions = new Subscription();
  constructor(private catalog: PrescriptionMedicineCatalogService, private dialog: MatDialog, @Optional() @Inject(MAT_DIALOG_DATA) data: { embedded?: boolean } | null, private feedback: NotifyUpdateService = new NotifyUpdateService()) { this.embedded = data?.embedded === true; }
  get alphabetView() { return this.alphabet.view(this.options, this.query, option => matchesMedicineSearch(option.name, this.query), this.letterFilter); }
  get filtered(): PrescriptionMedicineOption[] { return this.alphabetView.items; }
  get visible(): PrescriptionMedicineOption[] { return this.pagination.slice(this.filtered); }
  get visibleGroups() { return this.alphabet.visibleGroups(this.alphabetView, this.pagination.limit); }
  onFilterChange(): void { this.pagination.reset(); }
  selectLetter(letter: string): void { this.letterFilter = letter === 'all' ? '' : letter; this.onFilterChange(); }
  clearFilters(): void { this.query = ''; this.letterFilter = ''; this.onFilterChange(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  ngOnInit(): void { void this.load(); this.subscriptions.add(this.catalog.changes.subscribe(() => void this.load())); }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); this.version++; }
  async load(refresh = false): Promise<void> {
    const version = ++this.version; this.loading = true;
    try { const options = await this.catalog.getAll(false, refresh); if (version === this.version) { this.options = options; this.error = ''; } }
    catch (error) { if (version === this.version) { this.error = error instanceof Error ? error.message : 'Unable to load medicines.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(option?: PrescriptionMedicineOption): void {
    this.error = ''; this.success = '';
    const ref = this.dialog.open(MedicineOptionDialogComponent, { data: option ? { id: option.id, name: option.name, strength: option.strength } : {}, width: '560px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe(saved => { if (saved) { this.success = 'Medicine saved.'; void this.load(); } }));
  }
  async delete(option: PrescriptionMedicineOption): Promise<void> {
    if (this.deletingId || !window.confirm('Remove ' + option.name + ' from future medicine selections? Saved records will keep their medicine text.')) return;
    this.deletingId = option.id; this.error = ''; this.success = '';
    try { await this.catalog.delete(option); this.feedback.success('Medicine deleted successfully. Saved records are preserved.', { title: 'Medicine deleted', route: '/prescription-medicines' }); this.success = 'Medicine removed from the catalogue.'; await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to remove this medicine.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.deletingId = ''; }
  }
  export(): void { exportRecords(this.filtered.map(option => ({ Medicine: medicineNameParts(option.name, option.strength).name, Strength: medicineNameParts(option.name, option.strength).strength })), 'prescription-medicines.xlsx', 'Medicines', this.feedback); }
}
