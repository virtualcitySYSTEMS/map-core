// source: https://github.com/modosc/global-jsdom/
import { JSDOM } from 'jsdom';

const KEYS = [];
const defaultHtml =
  '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="mapContainer"></div></body></html>';

export default function setupJSDOM() {
  // Idempotency
  if (
    global.navigator &&
    global.navigator.userAgent &&
    global.navigator.userAgent.includes('Node.js') &&
    global.document &&
    typeof global.document.destroy === 'function'
  ) {
    return global.document.destroy;
  }

  const jsdom = new JSDOM(defaultHtml, {
    pretendToBeVisual: true,
    url: 'http://localhost',
    referrer: 'http://localhost',
  });

  const { window } = jsdom;
  const { document } = window;

  if (KEYS.length === 0) {
    KEYS.push(
      ...Object.getOwnPropertyNames(window).filter(
        (k) => !k.startsWith('_') && !(k in global),
      ),
    );
    KEYS.push('$jsdom');
  }

  KEYS.forEach((key) => {
    global[key] = window[key];
  });

  global.document = document;
  global.window = window;
  window.console = global.console;
  global.$jsdom = jsdom;

  const cleanup = () => KEYS.forEach((key) => delete global[key]);

  document.destroy = cleanup;

  return cleanup;
}
