import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PrescriptionRecord, copyPrescription, emptyPrescription } from 'src/app/Models/prescription.model';
import { PrescriptionService } from 'src/app/Services/prescription.service';
import { MedicineCatalogComponent } from './medicine-catalog/medicine-catalog.component';
import { PRESCRIPTION_DOCUMENT_CSS, PRESCRIPTION_FIELDS, PRESCRIPTION_INSTRUCTIONS, PRESCRIPTION_DOCTOR,
  PrescriptionField, prescriptionDateTime, prescriptionHeader } from './prescription-document';
import { PrescriptionPreviewComponent } from './prescription-preview.component';
import { printPrescription } from './prescription-print';

@Component({
  selector: 'app-preciption',
  templateUrl: './precipion.component.html',
  styleUrls: ['./precipion.component.css'],
  styles: [PRESCRIPTION_DOCUMENT_CSS],
  encapsulation: ViewEncapsulation.None,
})
export class PreciptionComponent implements OnInit, OnDestroy {
  record = emptyPrescription();
  readonly fields = PRESCRIPTION_FIELDS;
  readonly instructions = PRESCRIPTION_INSTRUCTIONS;
  readonly doctor = PRESCRIPTION_DOCTOR;
  readonly headerHtml = prescriptionHeader(document.baseURI);
  loading = true;
  saving = false;
  loadFailed = false;
  storageError = '';
  successMessage = '';
  private routeSubscription?: Subscription;
  private clock?: ReturnType<typeof setInterval>;
  private loadVersion = 0;
  private editingId: string | null = null;

  constructor(private prescriptions: PrescriptionService,
    private route: ActivatedRoute, private router: Router, private dialog: MatDialog, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.editingId = params.get('prescriptionId');
      void this.load();
    });
    this.clock = setInterval(() => {
      if (!this.record.id && !this.loading && !this.saving) this.record.issuedAt = new Date().toISOString();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
    this.loadVersion++;
  }

  get blankRows(): number[] { return Array.from({ length: Math.max(0, 8 - this.record.medicines.length) }, (_, index) => index); }

  async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    this.loadFailed = false;
    this.storageError = '';
    try {
      const record = this.editingId ? await this.prescriptions.getById(this.editingId) : emptyPrescription();
      if (version !== this.loadVersion) return;
      if (!record) throw new Error('This prescription could not be found. Return to the prescription list.');
      this.record = copyPrescription(record);
    } catch (error) {
      if (version === this.loadVersion) {
        this.loadFailed = true;
        this.storageError = error instanceof Error ? error.message : 'Unable to load this prescription.'; if (this.storageError) this.feedback.alertNotify.next({ msg: this.storageError, type: 'error' });
      }
    } finally {
      if (version === this.loadVersion) this.loading = false;
    }
  }

  fieldValue(field: PrescriptionField): string {
    return field.key === 'date' || field.key === 'time'
      ? prescriptionDateTime(this.record.issuedAt, field.key) : this.record.patient[field.key];
  }

  setField(field: PrescriptionField, value: string): void {
    if (field.key !== 'date' && field.key !== 'time') this.record.patient[field.key] = value;
  }

  addMedicine(): void {
    if (!this.saving) this.record.medicines.push({ name: '', morning: false, afternoon: false, evening: false });
  }

  removeMedicine(index: number): void {
    if (!this.saving && this.record.medicines.length > 1) this.record.medicines.splice(index, 1);
  }

  manageMedicines(): void {
    if (this.saving) return;
    this.dialog.open(MedicineCatalogComponent, { data: { embedded: true }, width: '900px', maxWidth: '96vw', maxHeight: '90vh', panelClass: 'hmc-dialog-panel' });
  }

  async save(): Promise<boolean> {
    if (this.saving || this.loading || this.loadFailed) return false;
    this.storageError = '';
    this.successMessage = '';
    if (!this.record.patient.name.trim()) {
      this.storageError = 'Enter the patient name before saving.'; if (this.storageError) this.feedback.alertNotify.next({ msg: this.storageError, type: 'error' });
      return false;
    }
    this.saving = true;
    try {
      const editing = !!this.record.id;
      this.record = await this.prescriptions.save(this.record);
      this.successMessage = editing ? 'Prescription updated successfully.' : 'Prescription saved successfully.';
      this.feedback.success(this.successMessage, { route: '/prescriptions' });
      await this.router.navigate(['/prescriptions']);
      return true;
    } catch (error) {
      this.storageError = error instanceof Error ? error.message : 'Unable to save the prescription. Please try again.'; if (this.storageError) this.feedback.alertNotify.next({ msg: this.storageError, type: 'error' });
      return false;
    } finally {
      this.saving = false;
    }
  }

  preview(): void {
    this.dialog.open(PrescriptionPreviewComponent, { data: { record: this.snapshot() },
      width: '950px', maxWidth: '96vw', maxHeight: '94dvh', panelClass: 'prescription-preview-panel', autoFocus: false });
  }

  print(): void {
    if (!printPrescription(this.snapshot())) { this.storageError = 'Allow pop-ups for this site to print the prescription.'; if (this.storageError) this.feedback.alertNotify.next({ msg: this.storageError, type: 'error' }); }
    else this.feedback.info('Prescription prepared for printing.', { title: 'Print requested', route: '/prescriptions' });
  }

  private snapshot(): PrescriptionRecord {
    const record = copyPrescription(this.record);
    if (!record.id) record.issuedAt = new Date().toISOString();
    return record;
  }

}
