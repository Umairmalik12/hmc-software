import { Component } from '@angular/core';
import { LoadingService } from '../Services/loading.service';
import { NotifyUpdateService, ToastMessage } from '../Services/notify-update.service';

@Component({
  selector: 'app-feedback',
  template: `<ng-container *ngIf="loading.state$ | async as activity"><div *ngIf="activity.busy" class="app-activity" role="status" aria-live="polite"><span class="activity-bar" aria-hidden="true"></span><span class="activity-label"><span class="hmc-spinner" aria-hidden="true"></span>{{ activity.label }}</span></div></ng-container>
    <aside class="toast-stack" aria-label="Notifications"><app-alertbox *ngFor="let toast of notify.toasts$ | async; trackBy: trackToast" [message]="toast.msg" [type]="toast.type" (dismissed)="notify.dismiss(toast.id)" (mouseenter)="pause(toast.id)" (mouseleave)="resume(toast.id, $event)" (focusin)="pause(toast.id)" (focusout)="resume(toast.id, $event)"></app-alertbox></aside>`,
  styles: [':host{position:relative;z-index:2100}.toast-stack{position:fixed;z-index:2100;top:76px;right:20px;display:flex;flex-direction:column;gap:10px;width:min(390px,calc(100% - 28px));max-height:calc(100dvh - 100px);overflow:auto;overscroll-behavior:contain;padding:4px;pointer-events:none}.app-activity{position:fixed;inset:0 0 auto;z-index:2050;pointer-events:none}.activity-bar{display:block;height:3px;background:linear-gradient(90deg,transparent,#147d73,#70b8ae,transparent);background-size:200% 100%;animation:activity-travel 1.4s ease-in-out infinite}.activity-label{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;max-width:calc(100vw - 32px);padding:10px 15px;border:1px solid #dce8e7;border-radius:24px;background:#fffffff5;color:#25534f;box-shadow:0 4px 18px #173a3d18;font-size:12px;white-space:nowrap}.activity-label .hmc-spinner{width:15px;height:15px}@keyframes activity-travel{from{background-position:150% 0}to{background-position:-50% 0}}@media(max-width:600px){.toast-stack{right:10px;top:68px;width:calc(100% - 20px)}}@media(prefers-reduced-motion:reduce){.activity-bar{animation:none;background:#147d73}}@media print{.toast-stack,.app-activity{display:none!important}}'],
})
export class AppFeedbackComponent {
  constructor(public notify: NotifyUpdateService, public loading: LoadingService) {}
  trackToast(_index: number, toast: ToastMessage): number { return toast.id; }
  pause(id: number): void { this.notify.pause(id); }
  resume(id: number, event: Event): void {
    const host = event.currentTarget as HTMLElement;
    // Keep a message readable while either the pointer or keyboard focus is inside it.
    if (host.matches(':hover') || (event.type === 'focusout' ? host.contains((event as FocusEvent).relatedTarget as Node | null) : host.contains(document.activeElement))) return;
    this.notify.resume(id);
  }
}
