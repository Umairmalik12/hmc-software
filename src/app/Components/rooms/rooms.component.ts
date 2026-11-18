import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RoomOption, RoomService } from 'src/app/Services/room.service';
import { SupabaseDataService } from 'src/app/Services/supabase-data.service';
import { requiredText } from 'src/app/Services/validators.service';
import { exportRecords } from 'src/app/Shared/export-records';
import { ScrollPagination, trackRecord } from 'src/app/Shared/scroll-pagination';

@Component({
  selector: 'app-rooms',
  template: `<section class="body">
    <header class="list-header"><div class="list-intro"><span class="list-icon"><mat-icon>bed</mat-icon></span><div><h1>Rooms &amp; beds</h1><p>Manage the room and general ward bed options used by daily medicines.</p></div></div><a mat-stroked-button routerLink="/medicine"><mat-icon>arrow_back</mat-icon>Daily medicines</a><button mat-stroked-button type="button" (click)="export()"><mat-icon>file_download</mat-icon>Export</button></header>
    <form class="room-form" (ngSubmit)="save()" novalidate><mat-form-field appearance="outline"><mat-label>{{ editingId ? 'Edit room / bed' : 'New room / bed' }}</mat-label><input matInput [formControl]="name" maxlength="80" placeholder="e.g. Room 3 or GW Bed 3"><mat-error>Enter a room or bed name (up to 80 characters)</mat-error></mat-form-field><button [appBusy]="saving && !deletingId" mat-flat-button color="primary" type="submit" [disabled]="saving"><mat-icon>save</mat-icon>{{ saving && !deletingId ? 'Saving...' : (editingId ? 'Save changes' : 'Add room / bed') }}</button><button *ngIf="editingId" mat-stroked-button type="button" (click)="cancel()" [disabled]="saving">Cancel</button></form>
    <p class="form-note">Room and bed selections are optional. Renaming or removing an option keeps the room labels on previously saved medicine records.</p>
    <p *ngIf="error" class="form-error" role="alert">{{ error }}</p><p *ngIf="success" class="room-success" role="status">{{ success }}</p><p *ngIf="loading" role="status" class="hmc-loading-state">Loading rooms and beds...</p>
    <div class="search-bar"><mat-form-field appearance="outline"><mat-label>Search rooms / beds</mat-label><input matInput type="search" [(ngModel)]="query" (ngModelChange)="pagination.reset()"></mat-form-field><button [appBusy]="loading" mat-stroked-button type="button" (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon>Refresh</button></div>
    <div class="table-scroll-container" appScrollPagination [scrollTotal]="filtered.length" [scrollShown]="visible.length" [scrollResetKey]="pagination.revision" [scrollDisabled]="loading" (loadMore)="loadMore()" scrollLabel="Rooms and beds">
      <table class="room-table"><thead><tr><th>Room / bed</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let option of visible; trackBy: trackRecord"><td>{{ option.name }}</td><td><div class="action-buttons"><button mat-icon-button class="table-btn" color="accent" type="button" [appRecordPreview]="option" previewTitle="Room / bed preview" aria-label="Preview room or bed" title="Preview"><mat-icon>visibility</mat-icon></button><button mat-icon-button class="table-btn" color="primary" type="button" (click)="edit(option)" [disabled]="saving" aria-label="Edit room or bed" title="Edit"><mat-icon>edit_note</mat-icon></button><button [appBusy]="deletingId === option.id" mat-icon-button class="table-btn" color="warn" type="button" (click)="delete(option)" [disabled]="saving" aria-label="Delete room or bed" title="Delete"><mat-icon>delete_outline</mat-icon></button></div></td></tr></tbody></table>
      <div class="list-empty" *ngIf="!loading && !filtered.length">No rooms or beds to display.</div>
    </div><app-scroll-list-footer [total]="filtered.length" [shown]="visible.length" (loadMore)="loadMore()"></app-scroll-list-footer>
  </section>`,
  styles: ['.room-form{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}.room-form mat-form-field{flex:1;min-width:200px}.room-form button{margin-top:7px}.room-table{width:100%;border-collapse:collapse;font-size:13px}.room-table th,.room-table td{padding:13px 16px;text-align:left;border-bottom:1px solid #e1e9ed;overflow-wrap:anywhere}.room-table th{background:#f4f7f9}.room-table td:last-child{width:130px}.room-success{color:#267d6b;font-size:13px}'],
})
export class RoomsComponent implements OnInit, OnDestroy {
  readonly pagination = new ScrollPagination();
  readonly trackRecord = trackRecord;
  options: RoomOption[] = [];
  name = new FormControl('', { nonNullable: true, validators: [requiredText, Validators.maxLength(80)] });
  query = '';
  editingId = '';
  loading = false;
  saving = false;
  deletingId = '';
  error = '';
  success = '';
  private changes?: Subscription;
  private version = 0;
  constructor(private rooms: RoomService, private db: SupabaseDataService, private feedback: NotifyUpdateService = new NotifyUpdateService()) {}
  get filtered(): RoomOption[] { return this.options.filter(option => option.name.toLocaleLowerCase().includes(this.query.trim().toLocaleLowerCase())); }
  get visible(): RoomOption[] { return this.pagination.slice(this.filtered); }
  loadMore(): void { this.pagination.loadMore(this.filtered.length); }
  ngOnInit(): void { void this.load(); this.changes = this.db.changes.subscribe(collection => { if (collection === 'rooms') void this.load(); }); }
  ngOnDestroy(): void { this.changes?.unsubscribe(); this.version++; }
  async load(): Promise<void> {
    const version = ++this.version; this.loading = true;
    try { const options = await this.rooms.getAll(); if (version === this.version) { this.options = options; this.error = ''; } }
    catch (error) { if (version === this.version) { this.error = error instanceof Error ? error.message : 'Unable to load rooms and beds.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); } }
    finally { if (version === this.version) this.loading = false; }
  }
  edit(option: RoomOption): void { this.editingId = option.id; this.name.setValue(option.name); this.success = ''; }
  cancel(): void { this.editingId = ''; this.name.reset(''); }
  async save(): Promise<void> {
    if (this.saving) return;
    if (this.name.invalid) { this.name.markAsTouched(); this.feedback.warning('Enter a room or bed name before saving.'); return; }
    this.saving = true; this.error = ''; this.success = '';
    try { await this.rooms.save(this.name.value, this.editingId || undefined); this.cancel(); this.success = 'Room / bed saved.'; if (this.success) this.feedback.alertNotify.next({ msg: this.success, type: 'success' }); await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to save room or bed.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; }
  }
  async delete(option: RoomOption): Promise<void> {
    if (this.saving || !window.confirm('Remove ' + option.name + ' from future selections? Existing medicine records will keep their room label.')) return;
    this.saving = true; this.deletingId = option.id; this.error = ''; this.success = '';
    try { await this.rooms.delete(option); if (this.editingId === option.id) this.cancel(); this.success = 'Room / bed removed from future selections.'; if (this.success) this.feedback.alertNotify.next({ msg: this.success, type: 'success' }); await this.load(); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Unable to remove room or bed.'; if (this.error) this.feedback.alertNotify.next({ msg: this.error, type: 'error' }); }
    finally { this.saving = false; this.deletingId = ''; }
  }
  export(): void { exportRecords(this.filtered.map(option => ({ 'Room / bed': option.name })), 'rooms-and-beds.xlsx', 'Rooms and beds', this.feedback); }
}
