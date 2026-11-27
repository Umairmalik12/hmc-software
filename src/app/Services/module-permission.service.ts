import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseClientService } from './supabase-client.service';
import { UserLoginService } from './user-login.service';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export interface ModulePermission { moduleKey: string; view: boolean; create: boolean; edit: boolean; delete: boolean; }
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
  private readonly subject = new BehaviorSubject<readonly ModulePermission[]>([]);
  readonly changes: Observable<readonly ModulePermission[]> = this.subject.asObservable();
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

    if (!['admin', 'staff', 'user'].includes(role)) throw new Error('This account has an unsupported role. Contact the hospital administrator.');
    this.role = role;
    this.admin = role === 'admin';
    this.publishPermissions();
  }

  private clearPermissions(): void {
    this.role = '';
    this.admin = false;
    this.publishPermissions();
  }

  private publishPermissions(): void {
    // Supabase auth/realtime callbacks can run outside Angular's change detection.
    this.zone.run(() => this.subject.next(HMC_PERMISSION_MODULES.map(module => ({
      moduleKey: module.key, view: !!this.role, create: !!this.role, edit: this.admin, delete: this.admin,
    }))));
  }

  get currentRole(): string { return this.role; }
  get isAdmin(): boolean { return this.admin; }
  can(moduleKey: string, action: PermissionAction): boolean {
    if (!this.role || !HMC_PERMISSION_MODULES.some(module => module.key === moduleKey)) return false;
    return action === 'view' || action === 'create' || this.admin;
  }
}
