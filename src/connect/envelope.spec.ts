import { describe, expect, it } from '@jest/globals';
import { encodeEnvelopes } from '@bufbuild/connect/protocol';
import { createEnvelopeAsyncGenerator } from './envelope';
import '../polyfill';

async function* createByteAsyncGenerator(bytes: Uint8Array, chunkSize = 2) {
  let offset = 0;
  while (offset < bytes.length) {
    await Promise.resolve();
    const end = Math.min(offset + chunkSize, bytes.byteLength);
    yield bytes.slice(offset, end);
    offset = end;
  }
}

describe('createEnvelopeReadableStream()', () => {
  it('reads empty stream', async () => {
    const stream = createEnvelopeAsyncGenerator(
      createByteAsyncGenerator(new Uint8Array(0)),
    );
    const r = await stream.next();
    expect(r.done).toBeTruthy();
    expect(r.value).toBeUndefined();
  });
  it('reads multiple messages', async () => {
    const input = [
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        flags: 0b00000000,
      },
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xe0]),
        flags: 0b00000000,
      },
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xe1]),
        flags: 0b10000000,
      },
    ];
    const stream = createEnvelopeAsyncGenerator(
      createByteAsyncGenerator(encodeEnvelopes(...input)),
    );
    for (const want of input) {
      const r = await stream.next();
      expect(r.done).toBeFalsy();
      expect(r.value).toBeDefined();
      expect(r.value?.flags).toBe(want.flags);
      expect(r.value?.data).toEqual(want.data);
    }
    const r = await stream.next();
    expect(r.done).toBeTruthy();
  });
  it('reads multiple messages arriving at once', async () => {
    const input = [
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        flags: 0b00000000,
      },
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xe0]),
        flags: 0b00000000,
      },
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xe1]),
        flags: 0b10000000,
      },
    ];
    let sourceStreamPulls = 0;
    async function* sourceStream() {
      if (sourceStreamPulls > 0) {
        // This stream enqueues all envelopes at once, and our ReadableStream
        // for envelopes should return them all with subsequent calls to read()
        // without pulling from this underlying stream again.
        throw new Error('expected only a single pull on the underlying stream');
      }
      sourceStreamPulls++;
      yield encodeEnvelopes(...input);
    }
    const stream = createEnvelopeAsyncGenerator(sourceStream());
    for (const want of input) {
      const r = await stream.next();
      expect(r.done).toBeFalsy();
      expect(r.value).toBeDefined();
      expect(r.value?.flags).toBe(want.flags);
      expect(r.value?.data).toEqual(want.data);
    }
  });
  it('reads an EndStreamResponse out of usual order', async () => {
    const input = [
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        flags: 0b10000000,
      },
      {
        data: new Uint8Array([0xde, 0xad, 0xbe, 0xe1]),
        flags: 0b00000000,
      },
    ];
    const stream = createEnvelopeAsyncGenerator(
      createByteAsyncGenerator(encodeEnvelopes(...input)),
    );
    for (const want of input) {
      const r = await stream.next();
      expect(r.done).toBeFalsy();
      expect(r.value).toBeDefined();
      expect(r.value?.flags).toBe(want.flags);
      expect(r.value?.data).toEqual(want.data);
    }
    const r = await stream.next();
    expect(r.done).toBeTruthy();
  });
});
