import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TeamAccount, TeamAccountService } from '../../Services/team-account.service';
import { UserLoginService } from '../../Services/user-login.service';
import { NotifyUpdateService } from '../../Services/notify-update.service';
import { AccountEditComponent } from './account-edit.component';

@Component({ selector: 'app-team-accounts', standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `<section class="accounts-page">
    <header class="list-header"><div class="list-intro"><span class="list-icon"><mat-icon>manage_accounts</mat-icon></span><div><h1>Team accounts</h1><p>Manage HMC logins and update account credentials.</p></div></div><button mat-stroked-button type="button" (click)="editSelf()" [disabled]="loading || !self">My account</button><button mat-flat-button color="primary" type="button" (click)="edit()" [disabled]="loading"><mat-icon>person_add</mat-icon>Team signup</button></header>
    <div class="search-bar"><mat-form-field appearance="outline"><mat-label>Search accounts</mat-label><input matInput type="search" [(ngModel)]="query" placeholder="Name, email or role"></mat-form-field><span>{{ filtered.length }} accounts</span><button mat-stroked-button type="button" (click)="load()" [disabled]="loading"><mat-icon>refresh</mat-icon>Refresh</button></div>
    <p *ngIf="loading" class="hmc-loading-state" role="status">Loading team accounts…</p><p *ngIf="error" class="form-error" role="alert">{{ error }}</p>
    <div class="account-table"><table><thead><tr><th>Name</th><th>Login email</th><th>Role</th><th>Created</th><th>Last sign-in</th><th>Action</th></tr></thead><tbody><tr *ngFor="let user of filtered"><td><strong>{{ user.name || 'Name not recorded' }}</strong><small *ngIf="user.id === currentId">Your account</small></td><td>{{ user.email }}</td><td><span class="account-role">{{ user.role === 'admin' ? 'Admin' : 'Staff' }}</span></td><td>{{ user.createdAt | date:'dd MMM yyyy' }}</td><td>{{ user.lastSignInAt ? (user.lastSignInAt | date:'dd MMM yyyy, h:mm a') : 'Not signed in yet' }}</td><td><button mat-icon-button color="primary" type="button" (click)="edit(user)" [disabled]="loading" [attr.aria-label]="'Edit account for ' + user.email" title="Change email or password"><mat-icon>edit_note</mat-icon></button></td></tr></tbody></table></div>
    <p *ngIf="!loading && !error && !filtered.length" class="empty">No accounts match your search.</p>
  </section>`,
  styles: ['.accounts-page{padding:22px;border:1px solid #dfe9ec;border-radius:14px;background:#fff}.search-bar{display:flex;align-items:center;gap:12px}.search-bar mat-form-field{flex:1;max-width:450px}.search-bar>span{margin-right:auto;color:#627b84;font-size:12px}.account-table{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:13px;text-align:left;border-bottom:1px solid #e3ecef;font-size:12px}th{background:#f2f7f8;color:#536e79;font-weight:600}td small{display:block;margin-top:4px;color:#147d73;font-size:10px}.account-role{padding:5px 9px;border-radius:16px;background:#eaf5f3;color:#147d73}.empty{padding:20px;text-align:center;color:#627b84}@media(max-width:600px){.accounts-page{padding:14px}.search-bar{flex-wrap:wrap}.search-bar mat-form-field{flex-basis:100%;max-width:none}}'] })
export class TeamAccountsComponent implements OnInit {
  @Input() signup = false;
  users: TeamAccount[] = []; query = ''; currentId = ''; loading = true; error = '';
  constructor(private accounts: TeamAccountService, private login: UserLoginService, private dialog: MatDialog, private feedback: NotifyUpdateService) {}
  get filtered(): TeamAccount[] { const query = this.query.trim().toLowerCase(); return this.users.filter(user => [user.name, user.email, user.role].some(value => value.toLowerCase().includes(query))); }
  get self(): TeamAccount | undefined { return this.users.find(user => user.id === this.currentId); }
  async ngOnInit(): Promise<void> { await this.load(); if (this.signup && !this.error) this.edit(); }
  async load(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      if (await this.login.getLoginUser() !== 'admin') throw new Error('Only administrators can manage team accounts.');
      const [users, identity] = await Promise.all([this.accounts.getAll(), this.login.getStaffIdentity()]);
      this.users = users; this.currentId = identity.id;
    } catch (error) { this.users = []; this.error = error instanceof Error ? error.message : 'Unable to load accounts.'; this.feedback.error(this.error); }
    finally { this.loading = false; }
  }
  editSelf(): void { if (this.self) this.edit(this.self); }
  edit(user?: TeamAccount): void {
    if (this.loading || this.error) return;
    this.dialog.open(AccountEditComponent, { data: user || null, width: '540px', maxWidth: '94vw', maxHeight: '90vh', panelClass: 'hmc-dialog-panel', autoFocus: 'first-tabbable' }).afterClosed().subscribe(saved => { if (saved) void this.load(); });
  }
}
