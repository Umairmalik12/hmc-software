import { Component, OnDestroy, OnInit } from '@angular/core';
import { SupabaseDataService, PatientTokenSlip } from 'src/app/Services/supabase-data.service';
import { printThermal } from './thermal-print';
import { Subscription } from 'rxjs';

interface TokenDateGroup {
  date: string;
  slips: PatientTokenSlip[];
}

@Component({
  selector: 'app-patient-token',
  templateUrl: './patient-token.component.html',
  styleUrls: ['./patient-token.component.css'],
})
export class PatientTokenComponent implements OnInit, OnDestroy {
  customerName = '';
  today = '';
  selectedDate = '';
  currentTime = '';
  slips: PatientTokenSlip[] = [];
  historyGroups: TokenDateGroup[] = [];
  selectedSlip: PatientTokenSlip | null = null;
  // Remember the chosen thermal roll size between sessions.
  paperWidth: 58 | 80 = 58;
  generating = false;
  errorMessage = '';
  successMessage = '';

  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private realtimeSubscription?: Subscription;

  constructor(private indexedDb: SupabaseDataService) {}

  get todayTotal(): number {
    return this.slips.filter(slip => slip.date === this.today).length;
  }

  get selectedDateTotal(): number {
    return this.slips.filter(slip => slip.date === this.selectedDate).length;
  }

  get historicalTotal(): number {
    return this.slips.length;
  }

  get lastGeneratedToken(): string {
    const todaysSlips = this.slips
      .filter(slip => slip.date === this.today)
      .sort((a, b) => b.sequence - a.sequence);
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
        : 'Unable to load patient token history.';
    }
    this.realtimeSubscription = this.indexedDb.changes.subscribe(collection => {
      if (collection === 'patientTokens') {
        this.loadSlips().catch(error => {
          this.errorMessage = error instanceof Error ? error.message : 'Unable to refresh patient token history.';
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
  }

  async generateSlip(): Promise<void> {
    const name = this.customerName.trim();
    if (!name) {
      this.errorMessage = 'Enter a patient name before generating a token.';
      this.successMessage = '';
      return;
    }

    this.generating = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const slip = await this.indexedDb.createPatientToken(name);
      this.customerName = '';
      this.selectedDate = slip.date;
      this.selectedSlip = slip;
      this.successMessage = 'Token ' + slip.tokenNumber + ' generated successfully.';
      this.slips = this.slips.filter(savedSlip => savedSlip.id !== slip.id);
      this.slips.push(slip);
      this.slips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.updateHistory();
      this.printSelectedSlip();
      this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? 'Token generated, but history could not be refreshed: ' + error.message
          : 'Token generated, but history could not be refreshed.';
      });
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to save the patient token. Please try again.';
    } finally {
      this.generating = false;
    }
  }

  async deleteSlip(slip: PatientTokenSlip): Promise<void> {
    if (!window.confirm('Delete token ' + slip.tokenNumber + ' for ' + slip.customerName + '?')) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.indexedDb.deletePatientToken(slip.id);
      this.slips = this.slips.filter(savedSlip => savedSlip.id !== slip.id);
      this.updateHistory();
      if (this.selectedSlip && this.selectedSlip.id === slip.id) {
        this.selectedSlip = null;
      }
      this.successMessage = 'Token ' + slip.tokenNumber + ' deleted.';
      this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? 'Token deleted, but history could not be refreshed: ' + error.message
          : 'Token deleted, but history could not be refreshed.';
      });
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to delete the patient token.';
    }
  }

  filterByDate(date: string): void {
    if (date) {
      this.selectedDate = date;
      this.updateHistory();
    }
  }

  showToday(): void {
    this.selectedDate = this.today;
    this.updateHistory();
  }

  printSlip(slip: PatientTokenSlip): void {
    this.selectedSlip = slip;
    this.printSelectedSlip();
  }

  formatDate(date: string): string {
    const parts = date.split('-');
    return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : date;
  }

  private async loadSlips(): Promise<void> {
    this.slips = await this.indexedDb.getAllPatientTokens();
    this.slips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!this.selectedSlip && this.slips.length) {
      this.selectedSlip = this.slips[0];
    }
    this.updateHistory();
  }

  private updateHistory(): void {
    const selectedSlips = this.slips
      .filter(slip => slip.date === this.selectedDate)
      .sort((a, b) => a.sequence - b.sequence);
    this.historyGroups = selectedSlips.length
      ? [{ date: this.selectedDate, slips: selectedSlips }]
      : [];
  }

  private printSelectedSlip(): void {
    const el = document.getElementById('patient-token-slip-print');
    if (!el) return;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.display = 'block';
    clone.style.position = 'static';
    clone.style.width = this.paperWidth === 80 ? '72mm' : '48mm';
    clone.style.margin = '0';
    // remove the on-screen paper-size selector from the printout
    clone.querySelectorAll('.paper-control').forEach(n => n.remove());
    this.savePaperWidth();
    printThermal(clone.outerHTML, this.paperWidth);
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
      const wasShowingToday = this.selectedDate === this.today;
      this.today = date;
      if (wasShowingToday || !this.selectedDate) {
        this.selectedDate = date;
      }
      this.updateHistory();
      this.loadSlips().catch(error => {
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Unable to refresh patient token history.';
      });
    } else if (!this.selectedDate) {
      this.selectedDate = date;
      this.updateHistory();
    }
  }
}
