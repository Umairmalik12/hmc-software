import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({ selector: 'app-alertbox', templateUrl: './alertbox.component.html', styleUrls: ['./alertbox.component.css'] })
export class AlertboxComponent {
  @Input() message = '';
  @Input() type = 'info';
  @Output() dismissed = new EventEmitter<void>();
  get title(): string { return ({ success: 'Success', error: 'Action needed', warning: 'Please check', info: 'Update' } as Record<string, string>)[this.type] || 'Update'; }
  get icon(): string { return ({ success: 'check_circle', error: 'error_outline', warning: 'warning_amber', info: 'info_outline' } as Record<string, string>)[this.type] || 'info_outline'; }
}
