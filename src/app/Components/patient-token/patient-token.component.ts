import { Component, OnDestroy, OnInit } from '@angular/core';
import { IndexedDbService, PatientTokenSlip } from 'src/app/Services/indexed-db.service';

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
  paperWidth: 58 | 80 = 58;
  generating = false;
  errorMessage = '';
  successMessage = '';

  private clockTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private indexedDb: IndexedDbService) {}

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
    try {
      await this.loadSlips();
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Unable to load patient token history.';
    }
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
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
    document.body.classList.add('patient-token-printing');
    document.body.classList.toggle('patient-token-paper-80', this.paperWidth === 80);
    setTimeout(() => {
      try {
        window.print();
      } finally {
        document.body.classList.remove('patient-token-printing');
        document.body.classList.remove('patient-token-paper-80');
      }
    }, 150);
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
