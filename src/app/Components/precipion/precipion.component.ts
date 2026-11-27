import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Input, OnChanges, OnDestroy, OnInit, Optional, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgModel } from '@angular/forms';
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
import { OpdService } from 'src/app/Services/opd.service';
import { firstValueFrom } from 'rxjs';
import { PatientLookupService } from 'src/app/Services/patient-lookup.service';

@Component({
  selector: 'app-preciption',
  templateUrl: './precipion.component.html',
  styleUrls: ['./precipion.component.css'],
  styles: [PRESCRIPTION_DOCUMENT_CSS],
  encapsulation: ViewEncapsulation.None,
})
export class PreciptionComponent implements OnInit, OnDestroy, OnChanges {
  @Input() prescriptionId: string | null | undefined = undefined;
  @Input() opdVisitId: string | null = null;
  record = emptyPrescription();
  readonly fields = PRESCRIPTION_FIELDS;
  readonly instructions = PRESCRIPTION_INSTRUCTIONS;
  readonly doctor = PRESCRIPTION_DOCTOR;
  get headerHtml(): string { return prescriptionHeader(document.baseURI, this.record.doctorName); }
  loading = true;
  saving = false;
  loadFailed = false;
  storageError = '';
  successMessage = '';
  private routeSubscription?: Subscription;
  @ViewChild('issueDateTime') issueDateTime?: NgModel;
  private loadVersion = 0;
  private editingId: string | null = null;
  private patientLookupVersion = 0;
  matchedPatient = '';
  private patientPrefill: Record<string, string> = {};

  constructor(private prescriptions: PrescriptionService,
    private route: ActivatedRoute, private router: Router, private dialog: MatDialog, @Optional() private opdService: OpdService | null = null,
    private feedback: NotifyUpdateService = new NotifyUpdateService(), @Optional() private patientLookup: PatientLookupService | null = null) {}

  ngOnInit(): void {
    if (this.prescriptionId !== undefined) {
      this.editingId = this.prescriptionId;
      void this.load();
      return;
    }
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.editingId = params.get('prescriptionId');
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.loadVersion++;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.prescriptionId && !changes.prescriptionId.firstChange) || (changes.opdVisitId && !changes.opdVisitId.firstChange)) {
      this.routeSubscription?.unsubscribe();
      this.editingId = this.prescriptionId || null;
      void this.load();
    }
  }

  get isEditing(): boolean { return !!this.editingId || !!this.record.id; }

  get blankRows(): number[] { return Array.from({ length: Math.max(0, 8 - this.record.medicines.length) }, (_, index) => index); }

  async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    this.loadFailed = false;
    this.storageError = '';
    try {
      let record = this.editingId ? await this.prescriptions.getById(this.editingId) : emptyPrescription();
      if (!this.editingId && this.opdVisitId) {
        const linked = await this.prescriptions.getByOpdVisitId(this.opdVisitId);
        if (linked) record = linked;
      }
      if (version !== this.loadVersion) return;
      if (!record) throw new Error('This prescription could not be found. Return to the prescription list.');
      this.patientPrefill = {};
      this.record = copyPrescription(record);
      if (!this.editingId && this.opdVisitId) {
        if (!this.opdService) throw new Error('OPD visit information is unavailable. Return to OPD visits and try again.');
        const opd = await firstValueFrom(this.opdService.getOpdDetails(this.opdVisitId));
        if (version !== this.loadVersion) return;
        if (!opd) throw new Error('The linked OPD visit could not be found. Return to OPD visits and refresh.');
        this.record.opdVisitId = String(opd.visitId || this.opdVisitId);
        // Only map supplied OPD values into blank fields. Clinical fields remain for the doctor to complete.
        this.record.patient.refId ||= String(opd.patientId || '');
        this.record.patient.visit = String(opd.visitNumber || 1);
        this.record.patient.name ||= opd.patientName || '';
        this.record.patient.age ||= opd.age !== null && opd.age !== undefined && Number.isFinite(opd.age) ? String(opd.age) : '';
        this.record.patient.sex ||= opd.sex || '';
        this.record.patient.contact ||= opd.phone || '';
        this.record.patient.symptoms ||= opd.history || '';
        this.record.doctorName ||= opd.drName || '';
        if (!this.record.issuedAt && opd.date) {
          const time = /^\d{1,2}:\d{2}/.test(opd.time || '') ? opd.time : '00:00';
          const local = new Date(opd.date + 'T' + time);
          if (Number.isFinite(local.getTime())) this.record.issuedAt = local.toISOString();
        }
      }
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
    if (field.key === 'refId' && !this.record.id) void this.lookupPatient(value);
  }

  private async lookupPatient(value: unknown): Promise<void> {
    const version = ++this.patientLookupVersion, mr = Number(value); this.matchedPatient = '';
    Object.entries(this.patientPrefill).forEach(([field, previous]) => {
      const current = field === 'doctorName' ? this.record.doctorName : this.record.patient[field as keyof PrescriptionRecord['patient']];
      if (current === previous) {
        if (field === 'doctorName') this.record.doctorName = '';
        else (this.record.patient as any)[field] = '';
      }
    });
    this.patientPrefill = {};
    if (!this.patientLookup || !Number.isSafeInteger(mr) || mr < 1) return;
    try {
      const patient = await this.patientLookup.byMr(mr);
      if (version !== this.patientLookupVersion || Number(this.record.patient.refId) !== mr || !patient) return;
      const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
      const fields: Record<string, string> = { name, age: patient.age != null ? String(patient.age) : '', sex: patient.gender || '', contact: patient.phone || '', doctorName: patient.drName || '' };
      Object.entries(fields).forEach(([field, value]) => {
        const current = field === 'doctorName' ? this.record.doctorName : this.record.patient[field as keyof PrescriptionRecord['patient']];
        if (!current && value) {
          if (field === 'doctorName') this.record.doctorName = value;
          else (this.record.patient as any)[field] = value;
          this.patientPrefill[field] = value;
        }
      });
      this.matchedPatient = name;
    } catch { if (version === this.patientLookupVersion) this.matchedPatient = ''; }
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

  async save(status: 'draft' | 'completed' = 'completed'): Promise<boolean> {
    if (this.saving || this.loading || this.loadFailed) return false;
    this.storageError = '';
    this.successMessage = '';
    if (this.issueDateTime?.invalid) {
      this.issueDateTime.control.markAsTouched();
      this.storageError = 'Select both the prescription date and time, or clear both.';
      this.feedback.warning(this.storageError);
      return false;
    }
    if (!this.record.patient.name.trim()) {
      this.storageError = 'Enter the patient name before saving.'; if (this.storageError) this.feedback.alertNotify.next({ msg: this.storageError, type: 'error' });
      return false;
    }
    this.saving = true;
    try {
      const editing = !!this.record.id;
      this.record.status = status;
      this.record = await this.prescriptions.save(this.record);
      this.successMessage = status === 'draft' ? 'Prescription draft saved successfully.' : editing ? 'Prescription updated successfully.' : 'Prescription completed and saved successfully.';
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
    return record;
  }

}
