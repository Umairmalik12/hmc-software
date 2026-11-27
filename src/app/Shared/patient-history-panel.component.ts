import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { PatientHistoryEntry, PatientHistoryService } from '../Services/patient-history.service';
import { SupabaseDataService } from '../Services/supabase-data.service';
import { RecordDetailsComponent } from '../Components/record-details/record-details.component';
import { includesText } from './list-filters';

@Component({
  selector: 'app-patient-history-panel', exportAs: 'patientHistory', standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  template: `
    <section *ngIf="expandedMr !== null" class="history-panel" [id]="panelId" aria-live="polite">
      <header><div><h3>Linked records &middot; MR {{ expandedMr }}</h3><p>{{ expandedName }} &middot; {{ entries.length }} linked records, newest first</p></div><button mat-icon-button type="button" (click)="expandedMr = null" aria-label="Close linked records"><mat-icon>close</mat-icon></button></header>
      <div class="history-tools"><label>Search records<input type="search" [(ngModel)]="query" (ngModelChange)="limit = 20" placeholder="Doctor, record or details"></label><label>Module<select [(ngModel)]="module" (ngModelChange)="limit = 20"><option value="">All modules</option><option *ngFor="let value of modules" [value]="value">{{ value }}</option></select></label><button mat-stroked-button type="button" (click)="refresh(true)" [disabled]="loading"><mat-icon>refresh</mat-icon>Refresh</button></div>
      <p *ngIf="loading" role="status">Loading linked records...</p>
      <p *ngIf="error" class="history-error" role="alert">{{ error }} <button mat-button type="button" (click)="refresh(true)">Retry</button></p>
      <div class="history-entries" *ngIf="!loading && !error"><article *ngFor="let entry of matching | slice:0:limit; trackBy: trackEntry"><div><strong>{{ entry.module }}</strong><small>#{{ entry.id }} &middot; {{ dateLabel(entry.dateTime) }}</small><span>{{ entry.summary }}</span><small *ngIf="entry.doctor">{{ entry.doctor }}</small></div><button mat-stroked-button type="button" (click)="view(entry)"><mat-icon>visibility</mat-icon>View</button></article><p *ngIf="!matching.length">No linked records match these filters.</p></div>
      <button *ngIf="!loading && !error && matching.length > limit" mat-stroked-button type="button" (click)="limit = limit + 20">Load more linked records</button>
    </section>`,
  styles: [`
    :host{display:block;min-width:0}.history-panel{margin-top:16px;padding:16px;border:1px solid #dbe8e6;border-radius:12px;background:#f8fcfb;color:#3c5962}
    header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}h3{margin:0;color:#1d514c;font-size:15px}header p{margin:5px 0 12px;font-size:12px;overflow-wrap:anywhere}
    .history-tools{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px}.history-tools label{display:grid;gap:5px;flex:1 1 180px;font-size:11px;color:#607f89}.history-tools input,.history-tools select{box-sizing:border-box;width:100%;min-height:38px;padding:8px 10px;border:1px solid #d5e3e7;border-radius:7px;background:#fff;color:#31515b;font:inherit;font-size:12px}.history-tools button{min-height:38px;font-size:12px}
    .history-entries{display:grid;gap:8px;max-height:420px;overflow:auto;margin:10px 0;scrollbar-width:thin}.history-entries article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:#fff;border:1px solid #e1e9ed;border-radius:9px}.history-entries article>div{display:grid;gap:5px;min-width:0;overflow-wrap:anywhere}.history-entries strong{color:#294954;font-size:12px}.history-entries span{font-size:12px}.history-entries small{font-size:11px;color:#6d838c}.history-entries button{flex-shrink:0;font-size:12px}.history-error{color:#ad3e3e;font-size:12px}
    @media(max-width:600px){.history-panel{padding:12px}.history-entries article{flex-wrap:wrap}.history-entries button{margin-left:auto}}
    @media print{:host{display:none!important}}`],
})
export class PatientHistoryPanelComponent implements OnChanges, OnDestroy {
  @Input() records: readonly any[] = [];
  @Input() mrField = 'mrNumber';
  @Input() nameField = 'patientName';
  private static nextId = 0;
  readonly panelId = 'linked-patient-history-' + ++PatientHistoryPanelComponent.nextId;
  expandedMr: number | null = null;
  expandedName = '';
  loading = false; error = ''; query = ''; module = ''; limit = 20;
  private history = new Map<number, PatientHistoryEntry[]>();
  private signature = ''; private version = 0; private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private changes: Subscription;
  constructor(private service: PatientHistoryService, db: SupabaseDataService, private dialog: MatDialog) {
    this.changes = db.changes.subscribe(collection => {
      if (!['patientDetails','opdDetails','inpatientDetails','labDetails','medicineDetails','otFormData','payments','prescriptions','prescription'].includes(collection)) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { void this.refresh(); },150);
    });
  }
  field(record: any, path: string): any { return path.split('.').reduce((value,key) => value?.[key],record); }
  mr(record: any): number | null { const value = Number(this.field(record,this.mrField)); return Number.isSafeInteger(value) && value > 0 ? value : null; }
  ngOnChanges(): void {
    const signature = this.mrField + ':' + [...new Set(this.records.map(record => this.mr(record)))].sort().join(',');
    if (signature === this.signature) return;
    this.signature = signature;
    if (!this.records.some(record => this.mr(record) === this.expandedMr)) this.expandedMr = null;
    void this.refresh();
  }
  count(record: any): number { const mr = this.mr(record); return mr === null ? 0 : this.history.get(mr)?.length || 0; }
  toggle(record: any): void {
    const mr = this.mr(record); if (mr === null) return;
    this.expandedMr = this.expandedMr === mr ? null : mr; this.expandedName = String(this.field(record,this.nameField) || '');
    this.query = ''; this.module = ''; this.limit = 20;
  }
  get entries(): PatientHistoryEntry[] { return this.expandedMr === null ? [] : this.history.get(this.expandedMr) || []; }
  get modules(): string[] { return [...new Set(this.entries.map(entry => entry.module))].sort(); }
  get matching(): PatientHistoryEntry[] { return this.entries.filter(entry => (!this.module || entry.module === this.module) && includesText([entry.id,entry.doctor,entry.summary].join(' '),this.query)); }
  dateLabel(value: string): string {
    if (!value) return 'Date not recorded';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}) : value;
  }
  async refresh(force = false): Promise<void> {
    if (this.destroyed) return;
    if (force) this.service.invalidate();
    const version = ++this.version;
    const mrs = [...new Set(this.records.map(record => this.mr(record)).filter((mr): mr is number => mr !== null))];
    this.loading = !!mrs.length; this.error = '';
    try { const result = mrs.length ? await this.service.forPatients(mrs) : new Map<number, PatientHistoryEntry[]>(); if (version === this.version) this.history = result; }
    catch (error) { if (version === this.version) { this.history.clear(); this.error = error instanceof Error ? error.message : 'Linked records could not be loaded.'; } }
    finally { if (version === this.version) this.loading = false; }
  }
  view(entry: PatientHistoryEntry): void { this.dialog.open(RecordDetailsComponent,{ data: { title: entry.module,record: entry.record } }); }
  trackEntry(_index: number, entry: PatientHistoryEntry): string { return entry.module + ':' + entry.id; }
  ngOnDestroy(): void { this.destroyed = true; this.version++; this.changes.unsubscribe(); if (this.timer) clearTimeout(this.timer); }
}

@Component({
  selector: 'app-patient-history-link', standalone: true, imports: [CommonModule,MatButtonModule,MatIconModule],
  template: `<button *ngIf="panel.mr(record) !== null; else unlinked" type="button" mat-button (click)="panel.toggle(record)" [attr.aria-controls]="panel.panelId" [attr.aria-expanded]="panel.expandedMr === panel.mr(record)" [attr.aria-label]="'Linked records for MR ' + panel.mr(record)"><mat-icon>{{ panel.expandedMr === panel.mr(record) ? 'expand_less' : 'expand_more' }}</mat-icon><span><strong>MR {{ panel.mr(record) }}</strong><small>{{ panel.loading ? 'Loading...' : panel.error ? 'History unavailable' : panel.count(record) + ' linked records' }}</small></span></button><ng-template #unlinked><small class="unlinked">No MR linked</small></ng-template>`,
  styles: [':host{display:block;min-width:0}button{height:auto;min-height:38px;max-width:100%;padding:5px 4px;color:#157c73;text-align:left;line-height:1.4}button mat-icon{flex-shrink:0;width:18px;height:18px;font-size:18px;line-height:18px;margin-right:4px}span{display:inline-flex;flex-direction:column;align-items:flex-start;white-space:normal;overflow-wrap:anywhere}strong{font-size:11px}small{display:block;font-size:10px;color:#71878f;font-weight:400}.unlinked{padding-top:4px}'],
})
export class PatientHistoryLinkComponent {
  @Input() panel!: PatientHistoryPanelComponent;
  @Input() record: any;
}
