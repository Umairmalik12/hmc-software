import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage { id: number; msg: string; type: ToastType; }
interface ToastTimer { remaining: number; started: number; handle?: ReturnType<typeof setTimeout>; }

@Injectable({ providedIn: 'root' })
export class NotifyUpdateService implements OnDestroy {
  readonly notify = new Subject();
  readonly alertNotify = new Subject<{ msg: string; type: string }>();
  private state = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.state.asObservable();
  private timers = new Map<number, ToastTimer>();
  private nextId = 0;
  private subscription: Subscription;
  constructor() { this.subscription = this.alertNotify.subscribe(message => this.show(message.msg, message.type)); }
  success(msg: string): void { this.alertNotify.next({ msg, type: 'success' }); }
  error(msg: string): void { this.alertNotify.next({ msg, type: 'error' }); }
  warning(msg: string): void { this.alertNotify.next({ msg, type: 'warning' }); }
  info(msg: string): void { this.alertNotify.next({ msg, type: 'info' }); }
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
  private show(message: string, requestedType: string): void {
    const msg = message?.trim(); if (!msg) return;
    const type: ToastType = ['success', 'error', 'warning', 'info'].includes(requestedType) ? requestedType as ToastType : 'info';
    const duplicate = this.state.value.find(toast => toast.type === type && toast.msg === msg);
    if (duplicate) return;
    if (this.state.value.length >= 4) this.dismiss(this.state.value[0].id);
    const id = ++this.nextId;
    this.state.next([...this.state.value, { id, msg, type }]);
    this.timers.set(id, { remaining: type === 'error' ? 9000 : type === 'warning' ? 7500 : 5000, started: 0 }); this.resume(id);
  }
  ngOnDestroy(): void {
    this.subscription.unsubscribe(); this.timers.forEach(timer => { if (timer.handle) clearTimeout(timer.handle); }); this.timers.clear(); this.state.complete();
  }
}
