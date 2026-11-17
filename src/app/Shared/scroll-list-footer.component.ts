import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-scroll-list-footer',
  template: `<div class="scroll-list-footer" *ngIf="total > 0"><span aria-live="polite">Showing {{ shown }} of {{ total }} records<span *ngIf="shown >= total"> &middot; All records loaded</span></span><button *ngIf="shown < total" mat-stroked-button type="button" (click)="loadMore.emit()">Load more</button></div>`,
  styles: [':host{display:block}.scroll-list-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;margin-top:10px;color:#637b86;font-size:11px}.scroll-list-footer button{font-size:12px}'],
})
export class ScrollListFooterComponent {
  @Input() shown = 0;
  @Input() total = 0;
  @Output() loadMore = new EventEmitter<void>();
}
