/**
 * Prints the patient token slip on a thermal roll (58 mm or 80 mm).
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
 * Sizing rules (why the slip printed as a long blank page / cut-off words):
 *  - the page is sized from the MEASURED content, never a fixed A4 height, so
 *    the roll is cut right after the footer;
 *  - the slip is laid out at a width that always fits the page, and text that
 *    cannot fit is wrapped instead of clipped, so no word is ever cut in PDF;
 *  - font sizes shrink only as far as needed to keep the layout on one line,
 *    so the slip stays short while staying readable on 58 mm and 80 mm paper.
 */
export function printThermal(html: string, widthMm: 58 | 80): void {
  // Printable area of a standard 58/80 mm roll, leaving 5 mm of dead margin.
  const printWidth = widthMm === 80 ? '72mm' : '48mm';
  // 58 mm bodies are cramped: slightly smaller type keeps one-line rows.
  const scale = widthMm === 80 ? 1 : 0.94;

  const win = window.open('', '_blank', 'width=420,height=640,menubar=no,toolbar=no,location=no,status=no');
  if (!win) {
    alert('Please allow pop-ups for this site to print the token slip.');
    return;
  }

  const baseCss = `
    @page{margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0;background:#fff;color:#000;overflow:hidden}
    body{width:${printWidth}}
    #patient-token-slip-print{display:block;width:${printWidth};margin:0;padding:2mm 1.5mm;text-align:center;
      color:#000;background:#fff;word-wrap:break-word;overflow-wrap:break-word;
      font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:${(9 * scale).toFixed(1)}pt;line-height:1.25}
  `;

  const receiptCss = `
    .slip-brand{font-size:${(12.5 * scale).toFixed(1)}pt;font-weight:900;letter-spacing:.2pt;line-height:1.12;
      text-transform:uppercase;white-space:normal;overflow-wrap:anywhere}
    .slip-hospital{font-size:${(8 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:.5pt;line-height:1.2;
      text-transform:uppercase;opacity:.75}
    .slip-rule{height:0;margin:1.1mm 0;border:0;border-top:1px dashed #000;opacity:.85}
    .slip-title{font-size:${(8 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:1.2pt;line-height:1.2;
      text-transform:uppercase;opacity:.85}
    .slip-number{display:block;margin:.8mm 0 1.2mm;padding:.8mm 0;font-size:${(28 * scale).toFixed(1)}pt;
      font-weight:900;line-height:1.05;letter-spacing:.6pt;white-space:nowrap;
      border-top:1.6pt solid #000;border-bottom:1.6pt solid #000}
    .slip-row{display:flex;flex-wrap:nowrap;align-items:baseline;gap:1.5mm;margin:.45mm 0;text-align:left;
      font-size:${(8.5 * scale).toFixed(1)}pt;line-height:1.22}
    .slip-row .slip-label{flex:0 0 auto;font-weight:700;letter-spacing:.2pt;text-transform:uppercase;opacity:.7}
    .slip-row .slip-value{flex:1 1 auto;min-width:0;text-align:right;font-weight:700;white-space:nowrap;
      overflow-wrap:anywhere}
    .slip-footer{margin-top:.7mm;font-size:${(7.5 * scale).toFixed(1)}pt;font-weight:700;letter-spacing:.3pt;
      text-transform:uppercase;line-height:1.25}
    .slip-thanks{font-size:${(8.5 * scale).toFixed(1)}pt;font-weight:900;letter-spacing:.6pt;
      text-transform:uppercase;line-height:1.25}
  `;

  // Step 1 – measuring document at the real printable width (no @page height).
  win.document.open();
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token Slip</title>` +
    `<style>${baseCss}${receiptCss}</style></head><body>${html.trim()}</body></html>`,
  );
  win.document.close();

  let done = false;

  const build = (): void => {
    if (done) return;
    done = true;

    const slip = win.document.getElementById('patient-token-slip-print');

    // Shrink long values (e.g. a very long patient name) instead of clipping
    // them, so no word is ever cut on the PDF or on paper.
    slip?.querySelectorAll<HTMLElement>('.slip-value').forEach(value => {
      const box = value.parentElement as HTMLElement | null;
      if (!box) return;
      let size = parseFloat(getComputedStyle(value).fontSize);
      let guard = 0;
      while (value.scrollWidth > value.clientWidth && size > 6.5 && guard < 30) {
        size -= 0.5;
        value.style.fontSize = size + 'px';
        guard += 1;
      }
    });

    const px = slip ? Math.ceil(slip.getBoundingClientRect().height) : 0;
    // Page height = measured content height (96 CSS px per inch), rounded up.
    const pageHeightMm = Math.max(30, Math.ceil((px || 0) * 25.4 / 96));

    const pageCss = `
      @page{size:${printWidth} ${pageHeightMm}mm;margin:0}
      ${baseCss}
      ${receiptCss}
      html,body{width:${printWidth};height:auto;min-height:0;margin:0;padding:0;overflow:hidden}
      #patient-token-slip-print{display:block!important;width:${printWidth};margin:0;padding:2mm 1.5mm;
        break-inside:avoid;break-after:avoid;page-break-inside:avoid;page-break-after:avoid}
      body>*{display:none}
      #patient-token-slip-print{display:block}
    `;

    // Step 2 – print document, written once, single @page rule.
    win.document.open();
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token Slip</title>` +
      `<style>${pageCss}</style></head><body>${html.trim()}</body></html>`,
    );
    win.document.close();

    const printNow = (): void => {
      win.focus();
      win.print();
      win.setTimeout(() => win.close(), 400);
    };

    if (win.document.readyState === 'complete') {
      win.setTimeout(printNow, 150);
    } else {
      win.addEventListener('load', () => win.setTimeout(printNow, 150), { once: true });
    }
  };

  if (win.document.readyState === 'complete') {
    win.setTimeout(build, 150);
  } else {
    win.addEventListener('load', () => win.setTimeout(build, 150), { once: true });
  }
}
