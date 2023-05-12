import { Headers } from 'headers-polyfill';
import { FastTextDecoder, FastTextEncoder } from '../fast-text-encoding';

declare global {
  var GameGlobal: any;
}

function polyfill(target: any = global || window) {
  if (typeof target === 'object') {
    target['Headers'] = Headers;
    target['TextDecoder'] = FastTextDecoder;
    target['TextEncoder'] = FastTextEncoder;
  }
}

try {
  polyfill();
} catch (e) {}
try {
  polyfill(GameGlobal);
} catch (e) {}
try {
  window = window || {};
  polyfill(window);
} catch (e) {}
