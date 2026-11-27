import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SupabaseDataService, PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { printThermal } from './thermal-print';
import { Subscription } from 'rxjs';
import { exportRecords } from 'src/app/Shared/export-records';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';
import { buildPatientTokenReceipt } from './patient-token-receipt';
import { PatientTokenPreviewComponent } from './patient-token-preview.component';
import { calendarDate, clockValue } from 'src/app/Shared/date-time-values';

interface TokenDateGroup {
  date: string;
  slips: PatientTokenSlip[];
}

@Component({
  selector: 'app-patient-token',
  templateUrl: './patient-token.component.html',
  styleUrls: ['./patient-token.component.css'],
})
export class PatientTokenComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isSuperAdmin = false;
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  trackGroup(_index: number, group: TokenDateGroup): string { return group.date; }
  loadMore(): void { this.pagination.loadMore(this.filteredSlips.length); this.updateHistory(); }
  private loadVersion = 0;
  customerName = '';
  tokenDateTime = '';
  today = '';
  selectedDate = '';
  currentTime = '';
  slips: PatientTokenSlip[] = [];
  historyGroups: TokenDateGroup[] = [];
  selectedSlip: PatientTokenSlip | null = null;
  // Remember the chosen thermal roll size between sessions.
  paperWidth: 58 | 80 = 58;
  generating = false;
  loading = false;
  deletingId: number | null = null;
  errorMessage = '';
  successMessage = '';
  search = '';
  editingSlipId: number | null = null;
  editedPatientName = '';
  updating = false;

  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private realtimeSubscription?: Subscription;

  constructor(private indexedDb: SupabaseDataService, private dialog: MatDialog, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.isSuperAdmin && !this.isSuperAdmin) { this.editingSlipId = null; this.editedPatientName = ''; }
  }

  get todayTotal(): number {
    return this.slips.filter(slip => slip.date === this.today).length;
  }

  get selectedDateTotal(): number {
    return this.slips.filter(slip => !this.selectedDate || slip.date === this.selectedDate).length;
  }

  get historicalTotal(): number {
    return this.slips.length;
  }

  get lastGeneratedToken(): string {
    const todaysSlips = this.slips
      .filter(slip => slip.date === this.today)
      .sort((a, b) => b.id - a.id);
    return todaysSlips.length ? todaysSlips[0].tokenNumber : '—';
  }

  async ngOnInit(): Promise<void> {
    this.updateClock();
    // The slip is printed from a print window whose page box is the roll size;
    // 58 mm stays the default (the most common thermal roll in use here).
    this.detectPaperWidth();
    try {
      await this.loadSlips();
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to load patient token history.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
    }
    this.realtimeSubscription = this.indexedDb.changes.subscribe(collection => {
      if (collection === 'patientTokens') {
        this.loadSlips().catch(error => {
          this.errorMessage = error instanceof Error ? error.message : 'Unable to refresh patient token history.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
        });
      }
    });
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    this.realtimeSubscription?.unsubscribe();
    this.loadVersion++;
  }

  async generateSlip(): Promise<void> {
    if (this.generating || this.updating || this.deletingId !== null) return;
    const name = this.customerName.trim();
    if (!name) {
      this.errorMessage = 'Enter a patient name before generating a token.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
      this.successMessage = '';
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(this.tokenDateTime) || !calendarDate(this.tokenDateTime.slice(0, 10)) || !clockValue(this.tokenDateTime.slice(11))) {
      this.errorMessage = 'Select the token date and time before generating a slip.';
      this.successMessage = '';
      this.feedback.warning(this.errorMessage);
      return;
    }
    this.generating = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const slip = await this.indexedDb.createPatientToken(name, this.tokenDateTime);
      this.customerName = '';
      this.tokenDateTime = '';
      if (this.selectedDate) this.selectedDate = slip.date;
      this.search = '';
      this.selectedSlip = slip;
      this.successMessage = 'Token ' + slip.tokenNumber + ' generated successfully.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
      this.slips = this.slips.filter(savedSlip => savedSlip.id !== slip.id);
      this.slips.push(slip);
      this.slips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.pagination.reset();
      this.updateHistory();
      this.printSelectedSlip();
      this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? 'Token generated, but history could not be refreshed: ' + error.message
          : 'Token generated, but history could not be refreshed.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
      });
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to save the patient token. Please try again.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
    } finally {
      this.generating = false;
    }
  }

  async deleteSlip(slip: PatientTokenSlip): Promise<void> {
    if (this.deletingId !== null || this.generating || this.updating) return;
    try { await this.indexedDb.requirePermission('tokens', 'delete', 'You do not have permission to delete patient tokens.'); }
    catch (error) { this.feedback.error(error instanceof Error ? error.message : 'You do not have permission to delete patient tokens.'); return; }
    if (!window.confirm('Delete token ' + slip.tokenNumber + ' for ' + slip.customerName + '?')) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.deletingId = slip.id;
    try {
      await this.indexedDb.deletePatientToken(slip.id);
      this.slips = this.slips.filter(savedSlip => savedSlip.id !== slip.id);
      this.updateHistory();
      if (this.selectedSlip && this.selectedSlip.id === slip.id) {
        this.selectedSlip = null;
      }
      this.successMessage = 'Token ' + slip.tokenNumber + ' deleted.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
      this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? 'Token deleted, but history could not be refreshed: ' + error.message
          : 'Token deleted, but history could not be refreshed.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
      });
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to delete the patient token.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
    } finally { this.deletingId = null; }
  }

  filterByDate(date: string): void {
    this.selectedDate = date || '';
    this.pagination.reset();
    this.updateHistory();
  }

  showAllTokens(): void { this.search = ''; this.filterByDate(''); }
  showToday(): void { this.filterByDate(this.today); }

  printSlip(slip: PatientTokenSlip): void {
    this.selectedSlip = slip;
    this.previewSlip(slip);
  }

  previewSlip(slip: PatientTokenSlip): void {
    const preview = this.dialog.open(PatientTokenPreviewComponent, { data: { record: { ...slip }, paperWidth: this.paperWidth }, width: '480px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'hmc-dialog-panel' });
    preview.beforeClosed().subscribe(() => this.changePaperWidth(preview.componentInstance.paperWidth));
  }

  changePaperWidth(width: 58 | 80): void {
    this.paperWidth = width === 80 ? 80 : 58;
    this.savePaperWidth();
  }

  async editSlip(slip: PatientTokenSlip): Promise<void> { if (this.updating || this.generating || this.deletingId !== null) return; try { await this.indexedDb.requirePermission('tokens', 'edit', 'You do not have permission to edit patient tokens.'); this.editingSlipId = slip.id; this.editedPatientName = slip.customerName; } catch (error) { this.feedback.error(error instanceof Error ? error.message : 'You do not have permission to edit patient tokens.'); } }
  cancelEdit(): void { if (!this.updating) { this.editingSlipId = null; this.editedPatientName = ''; } }
  async saveSlip(slip: PatientTokenSlip): Promise<void> {
    if (this.updating || this.generating || this.deletingId !== null) return;
    if (!this.editedPatientName.trim()) { this.errorMessage = 'Enter the patient name.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); return; }
    this.updating = true;
    this.errorMessage = '';
    try {
      const saved = await this.indexedDb.updatePatientTokenName(slip.id, this.editedPatientName);
      this.slips = this.slips.map(item => item.id === saved.id ? saved : item);
      if (this.selectedSlip?.id === saved.id) this.selectedSlip = saved;
      this.editingSlipId = null;
      this.editedPatientName = '';
      this.updateHistory();
      this.successMessage = 'Patient name updated for token ' + saved.tokenNumber + '.'; if (this.successMessage) this.feedback.alertNotify.next({ msg: this.successMessage, type: 'success' });
    } catch (error) { this.errorMessage = error instanceof Error ? error.message : 'Unable to update patient name.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' }); }
    finally { this.updating = false; }
  }
  searchHistory(): void { this.pagination.reset(); this.updateHistory(); }
  exportToExcel(): void {
    exportRecords(this.filteredSlips, 'patient-tokens.xlsx', 'Patient tokens', this.feedback);
  }

  formatDate(date: string): string {
    const parts = date.split('-');
    return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : date;
  }

  private async loadSlips(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    try {
    const slips = await this.indexedDb.getAllPatientTokens();
    if (version !== this.loadVersion) return;
    this.slips = slips;
    this.slips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!this.selectedSlip && this.slips.length) {
      this.selectedSlip = this.slips[0];
    }
    this.updateHistory();

    } finally { if (version === this.loadVersion) this.loading = false; }
  }

  get filteredSlips(): PatientTokenSlip[] {
    return this.slips
      .filter(slip => !this.selectedDate || slip.date === this.selectedDate)
      .filter(slip => !this.search.trim() || (slip.tokenNumber + ' ' + slip.customerName).toLocaleLowerCase().includes(this.search.trim().toLocaleLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || a.sequence - b.sequence || a.id - b.id);
  }

  private updateHistory(): void {
    const selectedSlips = this.pagination.slice(this.filteredSlips);
    this.historyGroups = selectedSlips.length
      ? [{ date: this.selectedDate, slips: selectedSlips }]
      : [];
  }

  private printSelectedSlip(): void {
    if (!this.selectedSlip) return;
    this.savePaperWidth();
    printThermal(buildPatientTokenReceipt(this.selectedSlip), this.paperWidth, 'patient-token-slip-print', this.feedback);
  }

  private savePaperWidth(): void {
    try {
      localStorage.setItem('hmc.tokenPaperWidth', String(this.paperWidth));
    } catch {
      // storage may be unavailable (private mode); the selection still applies this session
    }
  }

  /**
   * Picks up the thermal roll width from the saved choice. Browsers do not
   * expose the selected printer's paper size without a print dialog, so the
   * roll is a saved preference (58 mm default) instead of a forced A4 layout.
   */
  private detectPaperWidth(): void {
    try {
      const saved = localStorage.getItem('hmc.tokenPaperWidth');
      if (saved === '80') this.paperWidth = 80;
      if (saved === '58') this.paperWidth = 58;
    } catch {
      // keep the default roll
    }
  }

  private updateClock(): void {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values: { [key: string]: string } = {};
    parts.forEach(part => values[part.type] = part.value);
    const date = values.year + '-' + values.month + '-' + values.day;
    this.currentTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);

    if (date !== this.today) {
      const refreshing = !!this.today;
      const wasShowingToday = refreshing && this.selectedDate === this.today;
      this.today = date;
      if (wasShowingToday) {
        this.selectedDate = date;
        this.pagination.reset();
      }
      this.updateHistory();
      if (refreshing) this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Unable to refresh patient token history.'; if (this.errorMessage) this.feedback.alertNotify.next({ msg: this.errorMessage, type: 'error' });
      });
    }
  }
}
