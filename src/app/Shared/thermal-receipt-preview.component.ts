import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { prepareThermalReceipt, setThermalPaperWidth, THERMAL_RECEIPT_CSS } from './thermal-receipt';

@Component({
  selector: 'app-thermal-receipt-preview',
  template: `<div class="thermal-preview-viewport"><div class="thermal-preview-paper" [style.width.mm]="paperWidth"><div #receipt class="thermal-receipt" [class.thermal-paper-58]="paperWidth === 58" [class.thermal-paper-80]="paperWidth === 80" [innerHTML]="html"></div></div></div>`,
  styles: [THERMAL_RECEIPT_CSS, 'app-thermal-receipt-preview{display:block;min-width:0}.thermal-preview-viewport{width:100%;overflow:auto}.thermal-preview-paper{box-sizing:border-box;margin:0 auto;background:#fff;box-shadow:0 2px 12px #18333e10}'],
  encapsulation: ViewEncapsulation.None,
})
export class ThermalReceiptPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() html = '';
  @Input() paperWidth: 58 | 80 = 58;
  @ViewChild('receipt') receipt?: ElementRef<HTMLElement>;
  private destroyed = false;
  constructor(private zone: NgZone) {}
  ngAfterViewInit(): void { this.scheduleFit(); }
  ngOnChanges(): void { this.scheduleFit(); }
  ngOnDestroy(): void { this.destroyed = true; }
  private scheduleFit(): void { this.zone.runOutsideAngular(() => { void Promise.resolve().then(() => { this.fit(); void document.fonts.ready.then(() => this.fit()); }); }); }
  private fit(): void {
    const receipt = this.receipt?.nativeElement;
    if (!this.destroyed && receipt?.isConnected) { setThermalPaperWidth(receipt, this.paperWidth); prepareThermalReceipt(receipt); }
  }
}