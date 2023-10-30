import { HeadersPolyfill, FastTextDecoder, FastTextEncoder } from './shims';

function polyfill(target = global || window) {
  if (typeof target === 'object') {
    target['Headers'] = HeadersPolyfill;
    target['TextDecoder'] = FastTextDecoder;
    target['TextEncoder'] = FastTextEncoder;
  }
}
try {
  polyfill();
} catch (e) {
  /* empty */
}
try {
  polyfill(GameGlobal);
} catch (e) {
  /* empty */
}
try {
  window = window || {};
  polyfill(window);
} catch (e) {
  /* empty */
}
