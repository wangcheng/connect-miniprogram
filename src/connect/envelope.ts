import { Code, ConnectError } from '@connectrpc/connect';
import type { EnvelopedMessage } from '@connectrpc/connect/protocol';

export async function* createEnvelopeAsyncGenerator(
  stream: AsyncGenerator<Uint8Array>,
): AsyncGenerator<EnvelopedMessage> {
  let buffer = new Uint8Array(0);

  function append(chunk: Uint8Array): void {
    const n = new Uint8Array(buffer.length + chunk.length);
    n.set(buffer);
    n.set(chunk, buffer.length);
    buffer = n;
  }
  for (;;) {
    let header: { length: number; flags: number } | undefined;
    innerloop: for (;;) {
      if (header === undefined && buffer.byteLength >= 5) {
        let length = 0;
        for (let i = 1; i < 5; i++) {
          length = (length << 8) + buffer[i];
        }
        header = { flags: buffer[0], length };
      }
      if (header !== undefined && buffer.byteLength >= header.length + 5) {
        break innerloop;
      }
      const result = await stream.next();
      if (result.done) {
        break innerloop;
      }
      append(result.value);
    }
    if (header === undefined) {
      if (buffer.byteLength == 0) {
        break;
      }
      throw new ConnectError('premature end of stream', Code.DataLoss);
    }
    const data = buffer.subarray(5, 5 + header.length);
    buffer = buffer.subarray(5 + header.length);
    yield {
      flags: header.flags,
      data,
    };
  }
}
