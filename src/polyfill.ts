import { Headers } from 'headers-polyfill';

declare global {
  var GameGlobal: any;
}

function polyfill(target: any = global || window) {
  if (typeof target !== 'object') {
    throw new Error('polyfill target is not an Object');
  }
  if (!target['Headers']) target['Headers'] = Headers;
}

try {
  polyfill();
} catch (e) {
  console.log(1);
}
try {
  polyfill(GameGlobal);
} catch (e) {
  console.log(2);
}
try {
  window = window || {};
  polyfill(window);
} catch (e) {
  console.log(3);
}
