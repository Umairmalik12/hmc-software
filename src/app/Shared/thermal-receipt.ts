export const THERMAL_RECEIPT_CSS = `
.thermal-paper-80{--thermal-width:72mm;--thermal-font:9pt;--thermal-brand:12.5pt;--thermal-small:8pt;--thermal-number:28pt;--thermal-row:8.5pt;--thermal-footer:7.5pt;--thermal-thanks:8.5pt}
.thermal-paper-58{--thermal-width:48mm;--thermal-font:8.5pt;--thermal-brand:11.8pt;--thermal-small:7.5pt;--thermal-number:26.3pt;--thermal-row:8pt;--thermal-footer:7pt;--thermal-thanks:8pt}
.thermal-receipt{box-sizing:border-box;display:block;position:static;width:var(--thermal-width,72mm);max-width:100%;margin:0 auto;padding:.8mm 1.5mm 3mm;color:#000;background:#fff;text-align:center;word-wrap:break-word;overflow-wrap:break-word;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:var(--thermal-font,9pt);font-weight:400;font-style:normal;letter-spacing:normal;word-spacing:normal;text-transform:none;line-height:1.25;break-inside:avoid;page-break-inside:avoid}
:where(.thermal-receipt) *{box-sizing:border-box}
:where(.thermal-receipt) .slip-brand,:where(.thermal-receipt) .slip-hospital,:where(.thermal-receipt) .slip-title,:where(.thermal-receipt) .slip-number,:where(.thermal-receipt) .slip-footer,:where(.thermal-receipt) .slip-thanks{width:100%;text-align:center}
:where(.thermal-receipt) .slip-brand{font-size:var(--thermal-brand,12.5pt);font-weight:900;letter-spacing:.2pt;line-height:1.12;text-transform:uppercase;white-space:normal;overflow-wrap:anywhere}
:where(.thermal-receipt) .slip-hospital{font-size:var(--thermal-small,8pt);font-weight:700;letter-spacing:.5pt;line-height:1.2;text-transform:uppercase}
:where(.thermal-receipt) .slip-rule{height:0;margin:1.1mm 0;border:0;border-top:1px dashed #000}
:where(.thermal-receipt) .slip-title{font-size:var(--thermal-small,8pt);font-weight:700;letter-spacing:1.2pt;line-height:1.2;text-transform:uppercase}
:where(.thermal-receipt) .slip-number{display:block;margin:.8mm 0 1.2mm;padding:.8mm 0;font-size:var(--thermal-number,28pt);font-weight:900;line-height:1.05;letter-spacing:.6pt;white-space:nowrap;border-top:1.6pt solid #000;border-bottom:1.6pt solid #000}
:where(.thermal-receipt) .slip-row{display:grid;grid-template-columns:16mm minmax(0,1fr);align-items:baseline;gap:1.5mm;margin:.45mm 0;text-align:left;font-size:var(--thermal-row,8.5pt);line-height:1.22}
:where(.thermal-receipt .slip-row) .slip-label{font-weight:700;letter-spacing:.2pt;text-transform:uppercase}
:where(.thermal-receipt .slip-row) .slip-value{min-width:0;text-align:right;font-weight:700;white-space:normal;overflow-wrap:anywhere}
:where(.thermal-receipt) .slip-footer{margin-top:.7mm;font-size:var(--thermal-footer,7.5pt);font-weight:700;letter-spacing:.3pt;text-transform:uppercase;line-height:1.25}
:where(.thermal-receipt) .slip-thanks{margin-top:.5mm;font-size:var(--thermal-thanks,8.5pt);font-weight:900;letter-spacing:.6pt;text-transform:uppercase;line-height:1.25}
:where(.thermal-receipt) .thermal-paper-feed{display:block;height:8mm;clear:both}
:where(.thermal-receipt) .paper-control{display:none!important}
`;

export function setThermalPaperWidth(el: HTMLElement, width: 58 | 80): void {
  el.classList.add('thermal-receipt');
  el.classList.toggle('thermal-paper-58', width === 58);
  el.classList.toggle('thermal-paper-80', width === 80);
}

export function prepareThermalReceipt(el: HTMLElement): void {
  const token = el.querySelector<HTMLElement>('.slip-number');
  const view = el.ownerDocument.defaultView;
  if (token && view) {
    token.style.fontSize = ''; token.style.whiteSpace = ''; token.style.overflowWrap = '';
    let size = parseFloat(view.getComputedStyle(token).fontSize);
    while (token.scrollWidth > token.clientWidth && size > 16) {
      size = Math.max(16, size - .5); token.style.fontSize = size + 'px';
    }
    if (token.scrollWidth > token.clientWidth) { token.style.whiteSpace = 'normal'; token.style.overflowWrap = 'anywhere'; }
  }
  if (!el.querySelector('.thermal-paper-feed')) {
    const feed = el.ownerDocument.createElement('div');
    feed.className = 'thermal-paper-feed'; feed.setAttribute('aria-hidden', 'true'); el.appendChild(feed);
  }
}
