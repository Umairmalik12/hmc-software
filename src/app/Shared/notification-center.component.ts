import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ActivityNotification, NotifyUpdateService } from '../Services/notify-update.service';

@Component({
  selector: 'app-notification-center',
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.css'],
})
export class NotificationCenterComponent {
  open = false;
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 10 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -10 },
  ];
  @ViewChild('bell', { read: ElementRef }) bell?: ElementRef<HTMLButtonElement>;
  constructor(public feedback: NotifyUpdateService, private router: Router) {}
  trackNotification(_index: number, notification: ActivityNotification): string { return notification.id; }
  close(): void { this.open = false; this.bell?.nativeElement.focus(); }
  keydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); this.close(); } }
  clear(): void { if (window.confirm('Clear all notifications?')) this.feedback.clearNotifications(); }
  markRead(item: ActivityNotification, link: HTMLButtonElement): void { this.feedback.markAsRead(item.id); link.focus(); }
  async activate(item: ActivityNotification): Promise<void> {
    this.feedback.markAsRead(item.id);
    if (!item.route) return;
    this.close();
    try { if (!await this.router.navigateByUrl(item.route)) this.feedback.error('The page could not be opened. Please try again.'); }
    catch { this.feedback.error('The page could not be opened. Please try again.'); }
  }
}
