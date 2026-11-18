import { prepareThermalReceipt, setThermalPaperWidth, THERMAL_RECEIPT_CSS } from 'src/app/Shared/thermal-receipt';

/** Print the same receipt geometry used by thermal previews, with feed after the last line. */
export function printThermal(html: string, widthMm: 58 | 80, receiptId = 'patient-token-slip-print'): void {
  const win = window.open('', '_blank', 'width=420,height=640,menubar=no,toolbar=no,location=no,status=no');
  if (!win) { alert('Please allow pop-ups for this site to print the receipt.'); return; }
  const baseCss = `@page{margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{width:${widthMm}mm;margin:0;padding:0;background:#fff;color:#000;overflow:visible}
    #${receiptId}{display:block!important;position:static!important}`;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>${baseCss}${THERMAL_RECEIPT_CSS}</style></head><body>${html.trim()}</body></html>`);
  win.document.close();
  let done = false;
  const build = (): void => {
    if (done || win.closed) return;
    done = true;
    const receipt = win.document.getElementById(receiptId);
    if (!receipt) { win.close(); return; }
    setThermalPaperWidth(receipt, widthMm); prepareThermalReceipt(receipt);
    // The measurement already includes bottom padding and the trailing 8 mm feed.
    const heightPx = Math.max(receipt.scrollHeight, receipt.getBoundingClientRect().height);
    const pageHeightMm = Math.max(30, Math.ceil(heightPx * 25.4 / 96) + 1);
    const pageStyle = win.document.createElement('style');
    pageStyle.textContent = `@page{size:${widthMm}mm ${pageHeightMm}mm;margin:0}`;
    win.document.head.appendChild(pageStyle);
    win.addEventListener('afterprint', () => win.close(), { once: true });
    win.setTimeout(() => { if (!win.closed) { win.focus(); win.print(); } }, 150);
  };
  const prepare = (): void => {
    const receipt = win.document.getElementById(receiptId);
    if (receipt) setThermalPaperWidth(receipt, widthMm);
    void win.document.fonts.ready.then(build);
  };
  if (win.document.readyState === 'complete') prepare();
  else win.addEventListener('load', prepare, { once: true });
}
