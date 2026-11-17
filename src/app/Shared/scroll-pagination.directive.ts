import { AfterViewInit, Directive, ElementRef, EventEmitter, HostBinding, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

@Directive({ selector: '[appScrollPagination]' })
export class ScrollPaginationDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() scrollTotal = 0;
  @Input() scrollShown = 0;
  @Input() scrollResetKey = 0;
  @Input() scrollDisabled = false;
  @Input() scrollLabel = 'Record list';
  @Output() loadMore = new EventEmitter<void>();
  @HostBinding('attr.tabindex') tabindex = '0';
  @HostBinding('attr.role') role = 'region';
  @HostBinding('attr.aria-label') get label(): string { return this.scrollLabel; }

  private frame: number | null = null;
  private waitingForShown: number | null = null;
  private lastTop = 0;
  private ready = false;
  private destroyed = false;
  private mutations?: MutationObserver;
  private resize?: ResizeObserver;

  constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) {}

  private readonly onScroll = (): void => {
    const top = this.element.nativeElement.scrollTop;
    const down = top > this.lastTop;
    this.lastTop = top;
    // Horizontal scrolling and upward scrolling must not append another batch.
    if (down) this.schedule();
  };
  private readonly onResize = (): void => this.schedule();

  ngAfterViewInit(): void {
    this.ready = true;
    const host = this.element.nativeElement;
    this.lastTop = host.scrollTop;
    this.zone.runOutsideAngular(() => {
      host.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onResize, { passive: true });
      this.mutations = new MutationObserver(() => this.schedule());
      this.mutations.observe(host, { childList: true, subtree: true, characterData: true });
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(() => this.schedule());
        this.resize.observe(host);
      }
    });
    this.schedule();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scrollResetKey']) {
      this.element.nativeElement.scrollTop = 0;
      this.lastTop = 0;
      this.waitingForShown = null;
    }
    if (changes['scrollShown'] && this.scrollShown !== this.waitingForShown) this.waitingForShown = null;
    this.schedule();
  }

  private schedule(): void {
    if (!this.ready || this.destroyed || this.frame !== null) return;
    this.zone.runOutsideAngular(() => {
      this.frame = window.requestAnimationFrame(() => { this.frame = null; this.check(); });
    });
  }

  private check(): void {
    const host = this.element.nativeElement;
    if (this.destroyed || this.scrollDisabled || host.clientHeight <= 0 || this.scrollShown >= this.scrollTotal || this.waitingForShown === this.scrollShown) return;
    const underfilled = host.scrollHeight <= host.clientHeight + 1;
    const nearBottom = host.scrollTop > 0 && host.scrollHeight - host.scrollTop - host.clientHeight <= 120;
    if (!underfilled && !nearBottom) return;
    // Only one request for each rendered batch, even during rapid scrolls.
    // A subsequent check waits until Angular has rendered the added rows.
    this.waitingForShown = this.scrollShown;
    this.zone.run(() => this.loadMore.emit());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.mutations?.disconnect();
    this.resize?.disconnect();
    this.element.nativeElement.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
  }
}
