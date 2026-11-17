import { escapeHtml } from './escape-html';

export function printA4(html: string, css: string, title: string, target?: Window | null): boolean {
  const popup = target === undefined ? window.open('', '_blank', 'width=900,height=850') : target;
  if (!popup || popup.closed) return false;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}
    @page{size:A4 portrait;margin:10mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{width:190mm;margin:0;padding:0;background:#fff;color:#000}
    #a4-page{position:relative;width:190mm;overflow:hidden;break-inside:avoid}
    #a4-content{width:190mm;transform-origin:top left}
    </style></head><body><div id="a4-page"><div id="a4-content">${html}</div></div></body></html>`);
  popup.document.close();
  const prepare = async (): Promise<void> => {
    await popup.document.fonts.ready;
    await Promise.all(Array.from(popup.document.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
    if (popup.closed) return;
    const page = popup.document.getElementById('a4-page')!;
    const content = popup.document.getElementById('a4-content')!;
    const bounds = content.getBoundingClientRect();
    const height = Math.max(bounds.height, content.scrollHeight);
    const scale = Math.min(1, (276 * 96 / 25.4) / Math.max(height, 1));
    content.style.position = 'absolute';
    content.style.top = '0';
    content.style.left = ((190 * 96 / 25.4) - bounds.width * scale) / 2 + 'px';
    content.style.transform = 'scale(' + scale + ')';
    page.style.height = Math.ceil(height * scale) + 'px';
    popup.addEventListener('afterprint', () => popup.close(), { once: true });
    popup.setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print(); } }, 100);
  };
  if (popup.document.readyState === 'complete') void prepare();
  else popup.addEventListener('load', () => void prepare(), { once: true });
  return true;
}
