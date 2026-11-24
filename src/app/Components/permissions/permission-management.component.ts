import { Component, OnInit } from '@angular/core';
import { NotifyUpdateService } from 'src/app/Services/notify-update.service';
import { HMC_PERMISSION_MODULES, ModulePermission, ModulePermissionService, RoleModulePermission } from 'src/app/Services/module-permission.service';

@Component({
  selector: 'app-permission-management',
  template: `<section class="permissions-page">
    <header><span class="page-icon"><mat-icon>admin_panel_settings</mat-icon></span><div><h1>Permission management</h1><p>Choose what each role can create, edit and delete. Every authenticated user can view all modules.</p></div></header>
    <div class="toolbar"><mat-form-field appearance="outline"><mat-label>Role</mat-label><mat-select [(ngModel)]="selectedRole" (selectionChange)="loadRole()"><mat-option *ngFor="let role of roles" [value]="role">{{ role | titlecase }}</mat-option></mat-select></mat-form-field><span class="view-note"><mat-icon>visibility</mat-icon> View is always enabled for authenticated users</span><span class="spacer"></span><button mat-stroked-button type="button" (click)="reset()" [disabled]="busy || selectedRole === 'admin'"><mat-icon>restart_alt</mat-icon>Reset to default</button><button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="busy || selectedRole === 'admin'"><mat-icon>save</mat-icon>{{ busy ? 'Saving…' : 'Save permissions' }}</button></div>
    <p *ngIf="loading" class="hmc-loading-state" role="status">Loading permissions…</p><p *ngIf="error" class="form-error" role="alert">{{ error }}</p>
    <div class="matrix-wrap"><table><thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th></tr></thead><tbody><tr *ngFor="let row of rows"><th scope="row">{{ row.label }}</th><td><mat-checkbox checked disabled aria-label="View always allowed"></mat-checkbox></td><td><mat-checkbox [(ngModel)]="row.create" [disabled]="busy || selectedRole === 'admin'" [aria-label]="row.label + ' create permission'"></mat-checkbox></td><td><mat-checkbox [(ngModel)]="row.edit" [disabled]="busy || selectedRole === 'admin'" [aria-label]="row.label + ' edit permission'"></mat-checkbox></td><td><mat-checkbox [(ngModel)]="row.delete" [disabled]="busy || selectedRole === 'admin'" [aria-label]="row.label + ' delete permission'"></mat-checkbox></td></tr></tbody></table></div>
    <p class="footnote" *ngIf="selectedRole === 'admin'">Admin always has full access; these permissions cannot be reduced.</p>
  </section>`,
  styles: [`:host{display:block}.permissions-page{padding:22px;border:1px solid #dfe9ec;border-radius:14px;background:#fff;box-shadow:0 4px 18px #172b4d08}header{display:flex;align-items:center;gap:13px;margin-bottom:20px}.page-icon{display:grid;place-items:center;flex:0 0 44px;height:44px;border:1px solid #d7ece8;border-radius:13px;background:#eff8f6;color:#118275}h1{margin:0;color:#173a3d;font-size:20px}header p{margin:4px 0 0;color:#6a8086;font-size:12px}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px;border:1px solid #e0eaed;border-radius:11px;background:#f7fafb}.toolbar mat-form-field{width:190px;margin:0}.view-note{display:flex;align-items:center;gap:6px;color:#49706d;font-size:12px}.view-note mat-icon{font-size:18px}.spacer{flex:1}.matrix-wrap{overflow:auto;margin-top:16px;border:1px solid #e0e9ec;border-radius:10px}table{width:100%;border-collapse:collapse;min-width:560px}th,td{height:48px;padding:8px 14px;border-bottom:1px solid #e7edef;text-align:left;font-size:12px}thead th{background:#f1f6f7;color:#49656a;font-weight:700}tbody th{font-weight:600;color:#28474b}td{text-align:center}tr:last-child th,tr:last-child td{border-bottom:0}.footnote{margin:12px 0 0;color:#698086;font-size:12px}@media(max-width:600px){.permissions-page{padding:14px}.toolbar mat-form-field{width:100%}.spacer{display:none}.toolbar button{flex:1}}`],
})
export class PermissionManagementComponent implements OnInit {
  readonly modules = HMC_PERMISSION_MODULES;
  roles: string[] = [];
  selectedRole = '';
  rows: Array<ModulePermission & { label: string }> = [];
  loading = false;
  busy = false;
  error = '';
  constructor(private permissions: ModulePermissionService, private feedback: NotifyUpdateService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> {
    this.loading = true; this.error = '';
    try { const matrix = await this.permissions.getMatrix(); this.roles = matrix.roles; this.selectedRole ||= this.roles.find(role => role !== 'admin') || this.roles[0] || ''; await this.loadRole(matrix.permissions); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Permission settings could not be loaded.'; }
    finally { this.loading = false; }
  }
  async loadRole(initial?: RoleModulePermission[]): Promise<void> {
    if (!this.selectedRole) return;
    this.loading = true; this.error = '';
    try { const source = (initial || (await this.permissions.getMatrix()).permissions).filter(item => item.role === this.selectedRole); this.rows = this.modules.map(module => { const saved = source.find(item => item.moduleKey === module.key); const admin = this.selectedRole === 'admin'; return { moduleKey: module.key, label: module.label, view: true, create: admin || !!saved?.create, edit: admin || !!saved?.edit, delete: admin || !!saved?.delete }; }); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Role permissions could not be loaded.'; }
    finally { this.loading = false; }
  }
  async save(): Promise<void> {
    if (!this.selectedRole || this.selectedRole === 'admin' || this.busy) return;
    this.busy = true; this.error = '';
    try { await this.permissions.saveMatrix(this.selectedRole, this.rows.map(({ label, ...permission }) => ({ ...permission, view: true }))); this.feedback.success('Role permissions saved and applied.', { title: 'Permissions updated', route: '/permissions' }); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Permissions could not be saved.'; this.feedback.error(this.error); }
    finally { this.busy = false; }
  }
  async reset(): Promise<void> {
    if (!this.selectedRole || this.selectedRole === 'admin' || this.busy || !window.confirm('Reset ' + this.selectedRole + ' permissions to the default settings?')) return;
    this.busy = true; this.error = '';
    try { await this.permissions.resetMatrix(this.selectedRole); await this.loadRole(); this.feedback.success('Role permissions reset to defaults.', { title: 'Permissions reset', route: '/permissions' }); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Permissions could not be reset.'; this.feedback.error(this.error); }
    finally { this.busy = false; }
  }
}
