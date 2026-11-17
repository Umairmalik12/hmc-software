/**
 * Prints a receipt on a thermal roll (58 mm or 80 mm).
 *
 * Layout contract with the slip markup (id = patient-token-slip-print):
 *   .slip-brand    hospital name (big + bold)
 *   .slip-hospital hospital line
 *   .slip-rule     dashed divider
 *   .slip-title    "PATIENT TOKEN"
 *   .slip-number   big bold token number
 *   .slip-row > .slip-label + .slip-value
 *   .slip-footer   "PLEASE WAIT FOR YOUR TURN"
 *   .slip-thanks   "THANK YOU!"
 *
 * The page uses the selected roll width, with the printable area centered on
 * it. Its height includes the rendered receipt, bottom padding, and a blank
 * paper-feed area after the footer. Measure and print the same DOM so wrapping
 * and fitted token numbers cannot change between those steps.
 */
export function printThermal(html: string, widthMm: 58 | 80, receiptId = 'patient-token-slip-print'): void {
  // Keep the existing printable widths within the physical roll width.
  const printWidth = widthMm === 80 ? '72mm' : '48mm';
  const feedMm = 8;
  // 58 mm bodies are cramped: slightly smaller type keeps one-line rows.
  const scale = widthMm === 80 ? 1 : 0.94;

  const win = window.open('', '_blank', 'width=420,height=640,menubar=no,toolbar=no,location=no,status=no');
  if (!win) {
    alert('Please allow pop-ups for this site to print the receipt.');
    return;
  }

  const baseCss = `
    @page{margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{width:${widthMm}mm;margin:0;padding:0;background:#fff;color:#000;overflow:visible}
    #${receiptId}{display:block;position:static;width:${printWidth};max-width:100%;margin:0 auto;
      padding:.8mm 1.5mm 3mm;text-align:center;break-inside:avoid;page-break-inside:avoid;
      color:#000;background:#fff;word-wrap:break-word;overflow-wrap:break-word;
      font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:${(9 * scale).toFixed(1)}pt;line-height:1.25}
  `;

  const receiptCss = `
    .slip-brand,.slip-hospital,.slip-title,.slip-number,.slip-footer,.slip-thanks{width:100%;text-align:center}
    .slip-brand{font-size:${(12.5 * scale).toFixed(1)}pt;font-weight:900;letter-spacing:.2pt;line-height:1.12;
      text-transform:uppercase;white-space:normal;overflow-wrap:anywhere}
    .slip-hospital{font-size:${(8 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:.5pt;line-height:1.2;
      text-transform:uppercase}
    .slip-rule{height:0;margin:1.1mm 0;border:0;border-top:1px dashed #000}
    .slip-title{font-size:${(8 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:1.2pt;line-height:1.2;
      text-transform:uppercase}
    .slip-number{display:block;margin:.8mm 0 1.2mm;padding:.8mm 0;font-size:${(28 * scale).toFixed(1)}pt;
      font-weight:900;line-height:1.05;letter-spacing:.6pt;white-space:nowrap;
      border-top:1.6pt solid #000;border-bottom:1.6pt solid #000}
    .slip-row{display:grid;grid-template-columns:16mm minmax(0,1fr);align-items:baseline;gap:1.5mm;
      margin:.45mm 0;text-align:left;
      font-size:${(8.5 * scale).toFixed(1)}pt;line-height:1.22}
    .slip-row .slip-label{font-weight:700;letter-spacing:.2pt;text-transform:uppercase}
    .slip-row .slip-value{min-width:0;text-align:right;font-weight:700;white-space:normal;
      overflow-wrap:anywhere}
    .slip-footer{margin-top:.7mm;font-size:${(7.5 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:.3pt;
      text-transform:uppercase;line-height:1.25}
    .slip-thanks{font-size:${(8.5 * scale).toFixed(1)}pt;font-weight:900;letter-spacing:.6pt;
      text-transform:uppercase;line-height:1.25;margin-top:.5mm}
    .thermal-paper-feed{display:block;height:${feedMm}mm;clear:both}
    .paper-control{display:none!important}
  `;

  // Lay out once at the printable width before assigning the measured page size.
  win.document.open();
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>` +
    `<style>${baseCss}${receiptCss}</style></head><body>${html.trim()}</body></html>`,
  );
  win.document.close();

  let done = false;

  const build = (): void => {
    if (done) return;
    done = true;

    const slip = win.document.getElementById(receiptId);

    if (!slip) {
      win.close();
      return;
    }

    // Long names wrap in the value column; unusually long tokens are fitted
    // first, with wrapping as a fallback rather than overflowing the paper.
    const token = slip.querySelector<HTMLElement>('.slip-number');
    if (token) {
      let size = parseFloat(win.getComputedStyle(token).fontSize);
      while (token.scrollWidth > token.clientWidth && size > 16) {
        size = Math.max(16, size - .5);
        token.style.fontSize = size + 'px';
      }
      if (token.scrollWidth > token.clientWidth) {
        token.style.whiteSpace = 'normal';
        token.style.overflowWrap = 'anywhere';
      }
    }

    // A real trailing block reserves paper after THANK YOU, even when the
    // driver cuts immediately at the end of the browser's page.
    const feed = win.document.createElement('div');
    feed.className = 'thermal-paper-feed';
    feed.setAttribute('aria-hidden', 'true');
    slip.appendChild(feed);

    // Both measurements already include padding and the feed block. Add only
    // 1 mm for rounding when converting CSS pixels to the driver's page size.
    const heightPx = Math.max(slip.scrollHeight, slip.getBoundingClientRect().height);
    const pageHeightMm = Math.max(30, Math.ceil(heightPx * 25.4 / 96) + 1);
    const pageStyle = win.document.createElement('style');
    pageStyle.textContent = `@page{size:${widthMm}mm ${pageHeightMm}mm;margin:0}`;
    win.document.head.appendChild(pageStyle);

    const printNow = (): void => {
      win.focus();
      win.print();
    };

    win.addEventListener('afterprint', () => win.close(), { once: true });
    win.setTimeout(printNow, 150);
  };

  const prepare = (): void => {
    // Wait for font metrics before measuring the final height.
    void win.document.fonts.ready.then(build);
  };

  if (win.document.readyState === 'complete') {
    prepare();
  } else {
    win.addEventListener('load', prepare, { once: true });
  }
}
