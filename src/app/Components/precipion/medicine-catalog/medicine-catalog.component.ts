import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { medicineKey, PrescriptionMedicineCatalogService, PrescriptionMedicineOption } from 'src/app/Services/prescription-medicine-catalog.service';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { exportRecords } from 'src/app/Shared/export-records';
import { MedicineOptionDialogComponent } from './medicine-option-dialog.component';

@Component({
  selector: 'app-prescription-medicine-catalog',
  template: `<section [class.body]="!embedded" [class.rx-catalog-modal]="embedded">
    <header class="list-header"><div class="list-intro"><span class="list-icon"><mat-icon>medication</mat-icon></span><div><h1>Medicine catalogue</h1><p>Shared medicine options for prescriptions and daily medicine records.</p></div></div><button *ngIf="embedded" mat-icon-button type="button" mat-dialog-close aria-label="Close medicine catalogue"><mat-icon>close</mat-icon></button><a *ngIf="!embedded" mat-stroked-button routerLink="/prescriptions"><mat-icon>arrow_back</mat-icon>Prescription records</a></header>
    <div class="rx-catalog-content"><p class="form-note">Catalogue changes apply to future selections. Saved prescriptions and daily medicine records keep their original medicine names and doses.</p>
      <p *ngIf="error" class="form-error" role="alert">{{ error }}</p><p *ngIf="success" class="rx-catalog-success" role="status">{{ success }}</p>
      <div class="search-bar"><mat-form-field appearance="outline"><mat-label>Search medicines</mat-label><mat-icon matPrefix>search</mat-icon><input matInput type="search" [(ngModel)]="query" (ngModelChange)="pagination.reset()" placeholder="Medicine name"></mat-form-field><button mat-flat-button color="primary" type="button" (click)="edit()" [disabled]="!!deletingId"><mat-icon>add</mat-icon>Add medicine</button><button [appBusy]="loading" mat-stroked-button type="button" (click)="load(true)" [disabled]="loading"><mat-icon>refresh</mat-icon>Refresh</button><button mat-stroked-button type="button" (click)="export()"><mat-icon>file_download</mat-icon>Export</button></div>
      <p *ngIf="loading" role="status" class="hmc-loading-state">Loading medicines...</p>
      <div class="table-scroll-container" appScrollPagination [scrollTotal]="filtered.length" [scrollShown]="visible.length" [scrollResetKey]="pagination.revision" [scrollDisabled]="loading" (loadMore)="loadMore()" scrollLabel="Medicine catalogue"><table class="rx-catalog-table"><thead><tr><th>Medicine name</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let option of visible; trackBy: trackRecord"><td>{{ option.name }}</td><td><div class="action-buttons"><button mat-icon-button class="table-btn" color="accent" type="button" [appRecordPreview]="option" previewTitle="Medicine preview" aria-label="Preview catalogue medicine" title="Preview"><mat-icon>visibility</mat-icon></button><button mat-icon-button class="table-btn" color="primary" type="button" (click)="edit(option)" [disabled]="!!deletingId" aria-label="Edit catalogue medicine" title="Edit"><mat-icon>edit_note</mat-icon></button><button [appBusy]="deletingId === option.id" mat-icon-button class="table-btn" color="warn" type="button" (click)="delete(option)" [disabled]="!!deletingId" aria-label="Delete catalogue medicine" title="Delete"><mat-icon>delete_outline</mat-icon></button></div></td></tr></tbody></table><div *ngIf="!loading && !filtered.length" class="list-empty">No medicines match your search.</div></div>
      <app-scroll-list-footer [total]="filtered.length" [shown]="visible.length" (loadMore)="loadMore()"></app-scroll-list-footer>
    </div>
  </section>`,
  styles: [':host{display:block;min-height:0}.rx-catalog-modal{display:flex;flex-direction:column;max-height:85vh;padding:22px;box-sizing:border-box}.rx-catalog-modal .list-header{flex:0 0 auto;margin-bottom:16px}.rx-catalog-modal h1{font-size:19px}.rx-catalog-content{min-height:0;overflow:auto}.rx-catalog-table{width:100%;border-collapse:collapse;font-size:13px}.rx-catalog-table th,.rx-catalog-table td{padding:13px 16px;text-align:left;border-bottom:1px solid #e1e9ed;overflow-wrap:anywhere}.rx-catalog-table th{background:#f4f7f9}.rx-catalog-table td:last-child{width:130px}.rx-catalog-modal .table-scroll-container{max-height:40vh}.rx-catalog-success{color:#267d6b;font-size:13px}@media(max-width:520px){.rx-catalog-modal{padding:16px}.rx-catalog-modal .list-header{gap:8px}.rx-catalog-modal .list-icon{display:none}}'],
})
export class MedicineCatalogComponent implements OnInit, OnDestroy {
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  readonly embedded: boolean;
  options: PrescriptionMedicineOption[] = [];
  query = '';
  loading = false;
  deletingId = '';
  error = '';
  success = '';
  private version = 0;
  private subscriptions = new Subscription();
  constructor(private catalog: PrescriptionMedicineCatalogService, private dialog: MatDialog, @Optional() @Inject(MAT_DIALOG_DATA) data: { embedded?: boolean } | null, private feedback: NotifyUpdateService = new NotifyUpdateService()) { this.embedded = data?.embedded === true; }
  get filtered(): PrescriptionMedicineOption[] { return this.options.filter(option => medicineKey(option.name).includes(medicineKey(this.query))); }
  get visible(): PrescriptionMedicineOption[] { return this.pagination.slice(this.filtered); }
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
    const ref = this.dialog.open(MedicineOptionDialogComponent, { data: option ? { id: option.id, name: option.name } : {}, width: '560px', maxWidth: '94vw', panelClass: 'hmc-dialog-panel' });
    this.subscriptions.add(ref.afterClosed().subscribe(saved => { if (saved) { this.success = 'Medicine saved.'; void this.load(); } }));
  }
  async delete(option: PrescriptionMedicineOption): Promise<void> {
    if (this.deletingId || !window.confirm('Remove ' + option.name + ' from future medicine selections? Saved records will keep their medicine text.')) return;
    this.deletingId = option.id; this.error = ''; this.success = '';
    try { await this.catalog.delete(option); this.feedback.success('Medicine removed from future selections. Saved records are preserved.'); this.success = 'Medicine removed from the catalogue.'; await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to remove this medicine.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.deletingId = ''; }
  }
  export(): void { exportRecords(this.filtered.map(option => ({ Medicine: option.name })), 'prescription-medicines.xlsx', 'Medicines'); }
}
