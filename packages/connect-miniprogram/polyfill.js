import { Headers } from 'headers-polyfill';

import { FastTextDecoder, FastTextEncoder } from './fast-text-encoding';

function polyfill(target = global || window) {
  if (typeof target === 'object') {
    target['Headers'] = Headers;
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

export { FastTextDecoder, FastTextEncoder, Headers as HeadersPolyfill };
