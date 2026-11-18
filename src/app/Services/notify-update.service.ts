import { Inject, Injectable, OnDestroy, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, distinctUntilChanged, map, Subject, Subscription } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage { id: number; msg: string; type: ToastType; }
export interface NotificationDetails { title?: string; route?: string; }
export interface ActivityNotification { id: string; title: string; description: string; type: ToastType; createdAt: string; read: boolean; route?: string; }
interface ToastTimer { remaining: number; started: number; handle?: ReturnType<typeof setTimeout>; }

@Injectable({ providedIn: 'root' })
export class NotifyUpdateService implements OnDestroy {
  readonly notify = new Subject();
  readonly alertNotify = new Subject<{ msg: string; type: string } & NotificationDetails>();
  private state = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.state.asObservable();
  private history = new BehaviorSubject<ActivityNotification[]>([]);
  readonly notifications$ = this.history.asObservable();
  readonly unreadCount$ = this.notifications$.pipe(map(items => items.filter(item => !item.read).length), distinctUntilChanged());
  private storageKey: string | null = null;
  private timers = new Map<number, ToastTimer>();
  private nextId = 0;
  private subscription: Subscription;
  constructor(@Optional() @Inject(Router) private router: Router | null = null) { this.subscription = this.alertNotify.subscribe(message => this.show(message.msg, message.type, message)); }
  success(msg: string, details: NotificationDetails = {}): void { this.alertNotify.next({ ...details, msg, type: 'success' }); }
  error(msg: string, details: NotificationDetails = {}): void { this.alertNotify.next({ ...details, msg, type: 'error' }); }
  warning(msg: string, details: NotificationDetails = {}): void { this.alertNotify.next({ ...details, msg, type: 'warning' }); }
  info(msg: string, details: NotificationDetails = {}): void { this.alertNotify.next({ ...details, msg, type: 'info' }); }

  setUser(userId: string | null): void {
    const key = userId ? 'hmc.notifications.' + userId : null;
    if (key === this.storageKey) return;
    this.state.value.forEach(toast => this.dismiss(toast.id));
    this.storageKey = key;
    let items: ActivityNotification[] = [];
    try {
      const stored: unknown = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
      if (Array.isArray(stored)) items = stored.filter((item): item is ActivityNotification => item && typeof item.id === 'string'
        && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.read === 'boolean'
        && ['success', 'error', 'warning', 'info'].includes(item.type) && typeof item.createdAt === 'string'
        && !Number.isNaN(Date.parse(item.createdAt))).slice(0, 100).map(item => ({ ...item, title: item.title.slice(0, 120), description: item.description.slice(0, 2000), route: this.safeRoute(item.route) }));
    } catch { /* Notifications continue in memory when browser storage is unavailable. */ }
    this.history.next(items);
  }

  markAsRead(id: string): void { this.updateHistory(this.history.value.map(item => item.id === id ? { ...item, read: true } : item)); }
  markAllAsRead(): void { this.updateHistory(this.history.value.map(item => ({ ...item, read: true }))); }
  clearNotifications(): void { this.updateHistory([]); }
  private updateHistory(items: ActivityNotification[]): void {
    this.history.next(items);
    try { if (this.storageKey) localStorage.setItem(this.storageKey, JSON.stringify(items)); } catch { /* Keep the current browser session usable. */ }
  }
  private safeRoute(route: unknown): string | undefined {
    return typeof route === 'string' && /^\/(?!\/)/.test(route) && !/[\\\u0000-\u001f]/.test(route) ? route : undefined;
  }
  private currentRoute(): string | undefined {
    const page = this.router?.url?.split(/[?#]/)[0];
    if (!page || page === '/') return undefined;
    if (page === '/home') return '/patient';
    if (page.startsWith('/prescriptions/')) return '/prescriptions';
    return page === '/ot-slip' ? '/ot-records' : this.safeRoute(page);
  }
  private title(type: ToastType, message: string): string {
    if (type === 'error') return 'Action needed';
    if (type === 'warning') return 'Please check';
    if (type === 'info') return 'System update';
    if (/delet|removed/i.test(message)) return 'Successfully deleted';
    if (/updat|changed/i.test(message)) return 'Successfully updated';
    if (/export|report/i.test(message)) return 'Report ready';
    return 'Successfully saved';
  }
  dismiss(id: number): void {
    const timer = this.timers.get(id); if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id); this.state.next(this.state.value.filter(toast => toast.id !== id));
  }
  pause(id: number): void {
    const timer = this.timers.get(id); if (!timer?.handle) return;
    clearTimeout(timer.handle); timer.handle = undefined; timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
  }
  resume(id: number): void {
    const timer = this.timers.get(id); if (!timer || timer.handle) return;
    timer.started = Date.now(); timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }
  private show(message: string, requestedType: string, details: NotificationDetails): void {
    const msg = message?.trim(); if (!msg) return;
    const type: ToastType = ['success', 'error', 'warning', 'info'].includes(requestedType) ? requestedType as ToastType : 'info';
    const duplicate = this.state.value.find(toast => toast.type === type && toast.msg === msg);
    if (!duplicate || type === 'success') {
      this.updateHistory([{ id: globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2),
        title: (details.title?.trim() || this.title(type, msg)).slice(0, 120), description: msg.slice(0, 2000), type,
        createdAt: new Date().toISOString(), read: false, route: details.route === undefined ? this.currentRoute() : this.safeRoute(details.route) }, ...this.history.value].slice(0, 100));
    }
    if (duplicate) return;
    if (this.state.value.length >= 4) this.dismiss(this.state.value[0].id);
    const id = ++this.nextId;
    this.state.next([...this.state.value, { id, msg, type }]);
    this.timers.set(id, { remaining: type === 'error' ? 9000 : type === 'warning' ? 7500 : 5000, started: 0 }); this.resume(id);
  }
  ngOnDestroy(): void {
    this.subscription.unsubscribe(); this.timers.forEach(timer => { if (timer.handle) clearTimeout(timer.handle); }); this.timers.clear(); this.state.complete(); this.history.complete();
  }
}
