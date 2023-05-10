import { EnvelopedMessage } from '@bufbuild/connect/protocol';
import { Code, ConnectError } from '@bufbuild/connect';

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

  let header: { length: number; flags: number } | undefined = undefined;
  for await (const chunk of stream) {
    append(chunk);
    for (;;) {
      if (header === undefined && buffer.byteLength >= 5) {
        let length = 0;
        for (let i = 1; i < 5; i++) {
          length = (length << 8) + buffer[i];
        }
        header = { flags: buffer[0], length };
      }
      if (header !== undefined && buffer.byteLength >= header.length + 5) {
        const data = buffer.subarray(5, 5 + header.length);
        buffer = buffer.subarray(5 + header.length);
        yield {
          flags: header.flags,
          data,
        };
        header = undefined;
      } else {
        break;
      }
    }
  }
  if (header !== undefined) {
    throw new ConnectError('premature end of stream', Code.DataLoss);
  }
}
