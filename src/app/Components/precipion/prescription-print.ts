import { PrescriptionRecord } from 'src/app/Models/prescription.model';
import { buildPrescriptionDocument, PRESCRIPTION_DOCUMENT_CSS } from './prescription-document';

/** Print the same document as preview, fitted to one A4 sheet after assets load. */
export function printPrescription(record: PrescriptionRecord): boolean {
  const popup = window.open('', '_blank', 'width=900,height=850');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prescription – Haq Medical Center</title>
    <style>${PRESCRIPTION_DOCUMENT_CSS}
    @page{size:A4 portrait;margin:10mm}
    html,body{width:190mm;margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    #prescription-print-page{position:relative;width:190mm;margin:0;padding:0;break-inside:avoid;overflow:hidden}
    .rx-sheet{max-width:none;margin:0;transform-origin:top left}
    </style></head><body><div id="prescription-print-page">${buildPrescriptionDocument(record, document.baseURI)}</div></body></html>`);
  popup.document.close();

  const prepare = async (): Promise<void> => {
    await popup.document.fonts.ready;
    await Promise.all(Array.from(popup.document.images).map(img => img.complete ? Promise.resolve()
      : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
    if (popup.closed) return;
    const page = popup.document.getElementById('prescription-print-page')!;
    const sheet = page.querySelector<HTMLElement>('.rx-sheet')!;
    const width = 190 * 96 / 25.4;
    const availableHeight = 276 * 96 / 25.4; // 1 mm tolerance for driver rounding.
    const bounds = sheet.getBoundingClientRect();
    const height = Math.max(sheet.scrollHeight, bounds.height);
    const scale = Math.min(1, availableHeight / height);
    sheet.style.position = 'absolute';
    sheet.style.left = (width - bounds.width * scale) / 2 + 'px';
    sheet.style.top = '0';
    sheet.style.transform = 'scale(' + scale + ')';
    page.style.height = Math.ceil(height * scale) + 'px';
    popup.addEventListener('afterprint', () => popup.close(), { once: true });
    popup.setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print(); } }, 100);
  };
  if (popup.document.readyState === 'complete') void prepare();
  else popup.addEventListener('load', () => void prepare(), { once: true });
  return true;
}
