import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';
import { UserLoginService } from './user-login.service';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export interface ModulePermission { moduleKey: string; view: boolean; create: boolean; edit: boolean; delete: boolean; }
export interface RoleModulePermission extends ModulePermission { role: string; }
export interface PermissionModule { key: string; label: string; }

export const HMC_PERMISSION_MODULES: PermissionModule[] = [
  { key: 'operation-patients', label: 'Operation patients' }, { key: 'opd', label: 'OPD visits' },
  { key: 'inpatient', label: 'Inpatients' }, { key: 'laboratory', label: 'Laboratory' },
  { key: 'tokens', label: 'Patient tokens' }, { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'medicine-catalog', label: 'Medicine catalogue' }, { key: 'daily-medicines', label: 'Daily medicines' },
  { key: 'ot-medicine-catalog', label: 'OT medicine catalogue' }, { key: 'ot-medicine-records', label: 'OT medicine records' },
  { key: 'expenses', label: 'Expenses' }, { key: 'payments', label: 'Payments' }, { key: 'staff', label: 'Staff & duties' },
  { key: 'doctors', label: 'Doctors & surgeons' }, { key: 'lab-tests', label: 'Lab test catalogue' },
  { key: 'procedures', label: 'Procedures' }, { key: 'rooms', label: 'Rooms & beds' }, { key: 'reports', label: 'Reports' },
];

@Injectable({ providedIn: 'root' })
export class ModulePermissionService {
  private role = '';
  private admin = false;
  private readonly permissionMap = new Map<string, ModulePermission>();
  private readonly subject = new BehaviorSubject<readonly ModulePermission[]>([]);
  readonly changes: Observable<readonly ModulePermission[]> = this.subject.asObservable();
  private realtime: any = null;
  private reloadTimer?: ReturnType<typeof setTimeout>;

  private loadVersion = 0;
  private pendingLoad?: Promise<void>;

  constructor(private supabase: SupabaseClientService, private users: UserLoginService, private zone: NgZone) {
    // Clear privileged UI immediately when the authenticated account changes.
    let currentUserId: string | null = null;
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id || null;
      if (_event === 'INITIAL_SESSION') { currentUserId = userId; return; }
      if (userId !== currentUserId) {
        currentUserId = userId;
        this.loadVersion++;
        this.pendingLoad = undefined;
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.clearPermissions();
        if (userId) {
          // An account change can invalidate an in-flight role lookup. Restart
          // outside the auth callback so the UI cannot remain in view-only mode.
          this.reloadTimer = setTimeout(() => {
            void this.load().catch(() => { /* load keeps unverified actions hidden. */ });
          }, 0);
        }
      }
    });
  }

  async load(): Promise<void> {
    if (this.pendingLoad) return this.pendingLoad;
    const version = ++this.loadVersion;
    const task = this.loadPermissions(version);
    this.pendingLoad = task;
    try { await task; }
    finally { if (this.pendingLoad === task) this.pendingLoad = undefined; }
  }

  private async loadPermissions(version: number): Promise<void> {
    const role = await this.users.getLoginUser();
    if (version !== this.loadVersion) return;
    if (role !== this.role) this.clearPermissions();
    if (!role) throw new Error('Sign in again to load your account permissions.');

    // Admin access comes from the existing protected account role. It must
    // not depend on the optional role matrix RPC being available or seeded.
    if (role === 'admin') {
      this.role = role;
      this.admin = true;
      this.publishPermissions();
      this.listenForChanges();
      return;
    }

    const { data, error } = await this.supabase.client.rpc('hmc_get_my_permissions');
    if (version !== this.loadVersion) return;
    if (error) throw new Error(error.message || 'Module permissions could not be loaded.');
    const payload = data as { role?: string; is_admin?: boolean; permissions?: ModulePermission[] } | null;
    if (!payload || payload.role !== role) throw new Error('Account permissions changed. Refresh the page to reload them.');
    this.role = role;
    this.admin = false;
    this.permissionMap.clear();
    for (const permission of payload?.permissions || []) this.permissionMap.set(permission.moduleKey, permission);
    this.publishPermissions();
    this.listenForChanges();
  }

  private clearPermissions(): void {
    this.role = '';
    this.admin = false;
    this.permissionMap.clear();
    this.publishPermissions();
  }

  private publishPermissions(): void {
    // Supabase auth/realtime callbacks can run outside Angular's change detection.
    this.zone.run(() => this.subject.next([...this.permissionMap.values()]));
  }

  get currentRole(): string { return this.role; }
  get isAdmin(): boolean { return this.admin; }
  can(moduleKey: string, action: PermissionAction): boolean {
    if (action === 'view') return true;
    if (this.admin) return true;
    return this.permissionMap.get(moduleKey)?.[action] === true;
  }

  async getMatrix(): Promise<{ roles: string[]; permissions: RoleModulePermission[] }> {
    const { data, error } = await this.supabase.client.rpc('hmc_get_permission_matrix');
    if (error) throw new Error(error.message || 'Permission settings could not be loaded.');
    return { roles: data?.roles || [], permissions: data?.permissions || [] };
  }

  async saveMatrix(role: string, permissions: ModulePermission[]): Promise<void> {
    const { error } = await this.supabase.client.rpc('hmc_save_role_permissions', { p_role: role, p_permissions: permissions });
    if (error) throw new Error(error.message || 'Permissions could not be saved.');
    if (role === this.role) await this.load();
  }

  async resetMatrix(role: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('hmc_reset_role_permissions', { p_role: role });
    if (error) throw new Error(error.message || 'Permissions could not be reset.');
    if (role === this.role) await this.load();
  }

  private listenForChanges(): void {
    if (this.realtime) return;
    this.realtime = this.supabase.client.channel('hmc-permission-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmc_role_module_permissions' }, () => {
        if (this.reloadTimer) clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(() => { void this.load().catch(() => { /* load clears unverified permissions. */ }); }, 120);
      })
      .subscribe() as any;
  }
}
