import { sameClinicalName } from 'src/app/Services/clinical-catalog.service';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { OtMedicineRecord } from 'src/app/Models/ot-medicine.model';
import { OtMedicineService } from 'src/app/Services/ot-medicine.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { UserLoginService } from 'src/app/Services/user-login.service';
import { exportRecords } from 'src/app/Shared/export-records';
import { OtMedicinePreviewComponent } from '../otslip/ot-medicine-preview.component';
import { printOtMedicine } from '../otslip/ot-medicine-document';

@Component({ selector: 'app-otlist', templateUrl: './otlist.component.html', styleUrls: ['./otlist.component.css'] })
export class OtlistComponent implements OnInit, OnDestroy {
  readonly trackRecord = trackRecord;
  allRecords: OtMedicineRecord[] = [];
  query = '';
  searchDoctorName = '';
  get savedDoctorValues(): string[] { return [...new Set(this.allRecords.map(record => record.doctorName).filter(Boolean))]; }
  readonly pagination = new ScrollPagination();
  onSearch(): void { this.pagination.reset(); }
  loadMore(): void { this.pagination.loadMore(this.filteredRecords.length); }
  isSuperAdmin = false;
  loading = false;
  deletingId = '';
  errorMessage = '';
  private changes?: Subscription;
  private version = 0;
  constructor(private records: OtMedicineService, private db: SupabaseDataService, private user: UserLoginService, private dialog: MatDialog, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  ngOnInit(): void {
    this.user.getLoginUser().then(role => this.isSuperAdmin = role === 'admin').catch(() => { this.errorMessage = 'Unable to load account permissions.'; this.feedback.error(this.errorMessage); });
    this.changes = this.db.changes.subscribe(collection => { if (collection === 'otFormData') void this.load(); });
    void this.load();
  }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  get filteredRecords(): OtMedicineRecord[] {
    const query = this.query.trim().toLocaleLowerCase();
    return this.allRecords.filter(record => (!this.searchDoctorName || sameClinicalName(record.doctorName, this.searchDoctorName)) && (!query || [record.patientName, record.doctorName, record.procedure, record.roomNumber, record.operationDate, record.id,
      ...record.products.map(product => product.name)].some(value => String(value || '').toLocaleLowerCase().includes(query))));
  }
  get visibleRecords(): OtMedicineRecord[] { return this.pagination.slice(this.filteredRecords); }
  async load(): Promise<void> {
    const version = ++this.version;
    this.loading = true;
    try { const records = await this.records.getAll(); if (version !== this.version) return;
      this.allRecords = records; this.errorMessage = '';
    } catch (error) { if (version === this.version) { this.errorMessage = error instanceof Error ? error.message : 'Unable to load OT records.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); } }
    finally { if (version === this.version) this.loading = false; }
  }
  preview(record: OtMedicineRecord): void { this.dialog.open(OtMedicinePreviewComponent, { data: { record }, width: '940px', maxWidth: '96vw', maxHeight: '94dvh', panelClass: 'ot-preview-panel' }); }
  print(record: OtMedicineRecord): void { this.errorMessage = printOtMedicine(record) ? '' : 'Allow pop-ups to print the OT medicine list.'; if (this.errorMessage) this.feedback.error(this.errorMessage); else this.feedback.info('OT medicine record prepared for printing.', { title: 'Print requested', route: '/ot-records' }); }
  async deleteOt(record: OtMedicineRecord): Promise<void> {
    if (this.deletingId || !window.confirm('Delete the OT medicine record for ' + record.patientName + '?')) return;
    this.deletingId = record.id;
    try { await this.records.delete(record.id); this.feedback.success('OT medicine record deleted successfully.'); this.allRecords = this.allRecords.filter(item => item.id !== record.id); await this.load(); }
    catch (error) { this.errorMessage = error instanceof Error ? error.message : 'Unable to delete the OT record.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.deletingId = ''; }
  }
  exportToExcel(): void { exportRecords(this.filteredRecords, 'ot-medicines.xlsx', 'OT medicines', this.feedback); }
}
