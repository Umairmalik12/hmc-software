import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PrescriptionRecord, copyPrescription } from 'src/app/Models/prescription.model';
import { PrescriptionService, PRESCRIPTIONS_COLLECTION } from 'src/app/Services/prescription.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { PrescriptionPreviewComponent } from './prescription-preview.component';
import { printPrescription } from './prescription-print';
import { exportRecords } from 'src/app/Shared/export-records';

@Component({
  selector: 'app-prescription-list',
  templateUrl: './prescription-list.component.html',
  styleUrls: ['./prescription-list.component.css'],
})
export class PrescriptionListComponent implements OnInit, OnDestroy {
  exportToExcel(): void { exportRecords(this.filteredRecords, 'prescriptions.xlsx', 'Prescriptions'); }
  records: PrescriptionRecord[] = [];
  query = '';
  readonly pagination = new ScrollPagination();
  onSearch(): void { this.pagination.reset(); }
  loadMore(): void { this.pagination.loadMore(this.filteredRecords.length); }
  loading = false;
  errorMessage = '';
  successMessage = '';
  deletingId = '';
  private changes?: Subscription;
  private loadVersion = 0;

  constructor(private prescriptions: PrescriptionService, private db: SupabaseDataService, private dialog: MatDialog, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}

  ngOnInit(): void {
    void this.load();
    this.changes = this.db.changes.subscribe(collection => {
      if (collection === PRESCRIPTIONS_COLLECTION || collection === 'prescription') void this.load();
    });
  }

  ngOnDestroy(): void { this.changes?.unsubscribe(); this.loadVersion++; }

  get filteredRecords(): PrescriptionRecord[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.records.filter(record => !query || [record.id, record.patient.name, record.patient.refId,
      record.patient.contact, record.patient.diagnosis, ...record.medicines.map(medicine => medicine.name),
      record.issuedAt ? new Date(record.issuedAt).toLocaleString() : '']
      .some(value => String(value || '').toLocaleLowerCase().includes(query)));
  }

  get visibleRecords(): PrescriptionRecord[] {
    return this.pagination.slice(this.filteredRecords);
  }

  async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const records = await this.prescriptions.getAll();
      if (version !== this.loadVersion) return;
      this.records = records;

    } catch (error) {
      if (version === this.loadVersion) { this.errorMessage = error instanceof Error ? error.message : 'Unable to load prescriptions.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    } finally {
      if (version === this.loadVersion) this.loading = false;
    }
  }

  preview(record: PrescriptionRecord): void {
    this.dialog.open(PrescriptionPreviewComponent, { data: { record: copyPrescription(record) },
      width: '950px', maxWidth: '96vw', maxHeight: '94dvh', panelClass: 'prescription-preview-panel', autoFocus: false });
  }

  print(record: PrescriptionRecord): void {
    this.errorMessage = printPrescription(copyPrescription(record)) ? '' : 'Allow pop-ups for this site to print the prescription.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
  }

  async delete(record: PrescriptionRecord): Promise<void> {
    if (this.deletingId || !window.confirm('Delete the prescription for ' + (record.patient.name || 'this patient') + '?')) return;
    this.deletingId = record.id;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.prescriptions.delete(record.id);
      this.records = this.records.filter(item => item.id !== record.id);
      this.successMessage = 'Prescription deleted.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });

    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to delete the prescription.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
    } finally {
      this.deletingId = '';
    }
  }

  trackRecord(_index: number, record: PrescriptionRecord): string { return record.id; }
}
