import { Injectable, ViewContainerRef } from '@angular/core';
import { NotifyUpdateService } from './notify-update.service';
@Injectable({ providedIn: 'root' })
export class ShowalertService {
  constructor(private notify: NotifyUpdateService) {}
  showAlert(message: string, type: string, _container?: ViewContainerRef): void { this.notify.alertNotify.next({ msg: message, type }); }
}
