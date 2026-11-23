import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProcedureOption, ProcedureService } from 'src/app/Services/procedure.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { requiredText } from 'src/app/Services/validators.service';
import { exportRecords } from 'src/app/Shared/export-records';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';

@Component({
  selector: 'app-procedures',
  template: `<section class="body">
    <header class="list-header"><div class="list-intro"><span class="list-icon"><mat-icon>medical_services</mat-icon></span><div><h1>Procedures</h1><p>Shared procedure options for operation patients and OT medicines.</p></div></div><button mat-stroked-button (click)="export()"><mat-icon>file_download</mat-icon>Export</button></header>
    <form class="procedure-form" (ngSubmit)="save()" novalidate><mat-form-field appearance="outline"><mat-label>{{ editingId ? 'Edit procedure' : 'New procedure' }}</mat-label><input matInput [formControl]="name" maxlength="120"><mat-error>Enter a procedure name</mat-error></mat-form-field><button [appBusy]="saving && !deletingId" mat-flat-button color="primary" type="submit" [disabled]="saving"><mat-icon>save</mat-icon>{{ saving && !deletingId ? 'Saving…' : (editingId ? 'Save changes' : 'Add procedure') }}</button><button *ngIf="editingId" mat-stroked-button type="button" (click)="cancel()" [disabled]="saving">Cancel</button></form>
    <p *ngIf="error" class="form-error" role="alert">{{ error }}</p><p *ngIf="loading" role="status" class="hmc-loading-state">Loading procedures…</p>
    <div class="search-bar"><mat-form-field appearance="outline"><mat-label>Search procedures</mat-label><input matInput [(ngModel)]="query" (ngModelChange)="onSearch()" type="search"></mat-form-field></div>
    <div class="table-scroll-container" appScrollPagination [scrollTotal]="filtered.length" [scrollShown]="visibleOptions.length" [scrollResetKey]="pagination.revision" [scrollDisabled]="loading" (loadMore)="loadMore()" scrollLabel="Procedures">
    <table class="procedure-table"><thead><tr><th>Procedure name</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let option of visibleOptions; trackBy: trackRecord"><td>{{ option.name }}</td><td><div class="action-buttons"><button mat-icon-button class="table-btn" color="accent" type="button" [appRecordPreview]="option" previewTitle="Procedure preview" aria-label="Preview procedure" title="Preview"><mat-icon>visibility</mat-icon></button><button mat-icon-button class="table-btn" color="primary" (click)="edit(option)" [disabled]="saving" aria-label="Edit procedure" title="Edit"><mat-icon>edit_note</mat-icon></button><button [appBusy]="deletingId === option.id" mat-icon-button class="table-btn" color="warn" (click)="delete(option)" [disabled]="saving" aria-label="Delete procedure" title="Delete"><mat-icon>delete_outline</mat-icon></button></div></td></tr></tbody></table></div>
    <app-scroll-list-footer [total]="filtered.length" [shown]="visibleOptions.length" (loadMore)="loadMore()"></app-scroll-list-footer>
    <div class="list-empty" *ngIf="!loading && !filtered.length">No procedures to display.</div>
  </section>`,
  styles: ['.procedure-form{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.procedure-form mat-form-field{flex:1;min-width:220px}.procedure-form button{margin-top:7px}.procedure-table{width:100%;border-collapse:collapse;font-size:13px}.procedure-table th,.procedure-table td{padding:13px 16px;border-bottom:1px solid #e1e9ed;text-align:left}.procedure-table th{background:#f4f7f9}.procedure-table td:last-child{width:120px}'],
})
export class ProceduresComponent implements OnInit, OnDestroy {
  @Input() isSuperAdmin = false;
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  get visibleOptions(): ProcedureOption[] { return this.pagination.slice(this.filtered); }
  onSearch(): void { this.pagination.reset(); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  options: ProcedureOption[] = [];
  name = new FormControl('', { nonNullable: true, validators: [Validators.required, requiredText, Validators.maxLength(120)] });
  editingId = '';
  query = '';
  loading = false;
  saving = false;
  deletingId = '';
  error = '';
  private changes?: Subscription;
  private version = 0;
  constructor(private procedures: ProcedureService, private db: SupabaseDataService, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  get filtered(): ProcedureOption[] { return this.options.filter(option => option.name.toLocaleLowerCase().includes(this.query.trim().toLocaleLowerCase())); }
  ngOnInit(): void { void this.load(); this.changes = this.db.changes.subscribe(collection => { if (collection === 'procedures') void this.load(); }); }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  async load(): Promise<void> {
    const version = ++this.version;
    this.loading = true;
    try { const options = await this.procedures.getAll(); if (version === this.version) { this.options = options; this.error = ''; } }
    catch (error) { if (version === this.version) { this.error = error instanceof Error ? error.message : 'Unable to load procedures.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(option: ProcedureOption): void { this.editingId = option.id; this.name.setValue(option.name); }
  cancel(): void { this.editingId = ''; this.name.reset(''); }
  async save(): Promise<void> {
    if (this.saving) return;
    if (this.name.invalid) { this.name.markAsTouched(); this.feedback.warning('Enter a procedure name before saving.'); return; }
    this.saving = true;
    try { const updating = !!this.editingId; await this.procedures.save(this.name.value, this.editingId || undefined); this.cancel(); this.feedback.success(updating ? 'Procedure updated successfully.' : 'Procedure saved successfully.', { route: '/procedures' }); await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save procedure.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; }
  }
  async delete(option: ProcedureOption): Promise<void> {
    if (this.saving || !window.confirm('Remove ' + option.name + ' from future selections? Existing records will keep their procedure.')) return;
    this.saving = true; this.deletingId = option.id;
    try { await this.procedures.delete(option); this.feedback.success('Procedure removed from future selections. Saved records are preserved.'); if (this.editingId === option.id) this.cancel(); await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to delete procedure.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; this.deletingId = ''; }
  }
  export(): void { exportRecords(this.filtered.map(option => ({ Procedure: option.name })), 'procedures.xlsx', 'Procedures', this.feedback); }
}
