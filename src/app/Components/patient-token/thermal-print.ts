/**
 * Prints an HTML string on thermal paper (58 mm or 80 mm roll).
 * Opens a dedicated print window so the browser's print preview
 * matches the narrow paper instead of a full A4 sheet.
 */
export function printThermal(html: string, widthMm: 58 | 80): void {
  const rollWidth = widthMm === 80 ? '80mm' : '58mm';
  const bodyWidth = widthMm === 80 ? '72mm' : '54mm'; // leave room for printer margins

  const css = `
    @page { size: ${rollWidth} 50mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      width: ${bodyWidth};
      margin: 0; padding: 0;
      font: 11px/1.2 Arial, Helvetica, sans-serif;
      color: #000; background: #fff;
    }
    #patient-token-slip-print {
      display: block; width: ${bodyWidth}; margin: 0; padding: 2mm 1mm;
      color: #000; background: #fff; text-align: center;
      font: 11px/1.2 Arial, Helvetica, sans-serif;
    }
    .slip-brand { font-size: 13px; line-height: 1.15; font-weight: 900; letter-spacing: .2px; }
    .slip-hospital { margin-top: 1px; font-size: 10px; font-weight: 600; }
    .slip-rule { height: 0; margin: 5px 0; border: 0; border-top: 1px dashed #000; }
    .slip-title { font-size: 11px; font-weight: 800; letter-spacing: 1px; }
    .slip-number { margin: 3px 0 5px; font-size: 32px; line-height: 1; font-weight: 900; }
    .slip-details { margin: 3px 0; text-align: left; overflow-wrap: anywhere; }
    .slip-details strong { font-weight: 800; }
    .slip-footer { margin-top: 3px; font-size: 9px; font-weight: 800; }
    img, svg { max-width: 100%; }
  `;

  // Use a normal-width window so Chrome's print preview controls are not clipped.
  const win = window.open('', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
  if (!win) {
    alert('Please allow pop-ups for this site to print the token slip.');
    return;
  }

  win.document.write(
    `<!DOCTYPE html><html><head><title>Token Slip</title><style>${css}</style></head><body>${html}</body></html>`,
  );
  win.document.close();

  const finish = () => {
    const slip = win.document.getElementById('patient-token-slip-print');
    if (slip) {
      // Size the custom page to the actual slip height so the roll is cut short.
      const heightMm = Math.max(38, Math.ceil(slip.getBoundingClientRect().height * 25.4 / 96 + 2));
      const pageRule = win.document.createElement('style');
      pageRule.textContent = `@page { size: ${rollWidth} ${heightMm}mm; margin: 0; }`;
      win.document.head.appendChild(pageRule);
    }
    win.focus();
    win.print();
    // Close the helper window shortly after the print dialog is dismissed.
    win.setTimeout(() => win.close(), 300);
  };

  // Let the browser finish layout before measuring the shortest usable roll length.
  if (win.document.readyState === 'complete') {
    win.setTimeout(finish, 200);
  } else {
    win.onload = () => win.setTimeout(finish, 200);
  }
}
