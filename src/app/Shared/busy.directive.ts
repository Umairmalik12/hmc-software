import { Directive, HostBinding, HostListener, Input } from '@angular/core';

@Directive({ selector: '[appBusy]' })
export class BusyDirective {
  @Input() appBusy = false;
  @HostBinding('class.hmc-button-busy') get busy(): boolean { return !!this.appBusy; }
  @HostBinding('attr.aria-busy') get ariaBusy(): string | null { return this.appBusy ? 'true' : null; }
  @HostListener('click', ['$event']) preventDuplicate(event: Event): void {
    if (this.appBusy) { event.preventDefault(); event.stopImmediatePropagation(); }
  }
}
