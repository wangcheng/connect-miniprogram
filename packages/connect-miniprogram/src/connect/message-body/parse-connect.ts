import { ConnectError } from '@connectrpc/connect';
import type { EnvelopedMessage } from '@connectrpc/connect/protocol';
import {
  endStreamFlag,
  endStreamFromJson,
} from '@connectrpc/connect/protocol-connect';

export async function* parseResponseBody<O>(
  body: AsyncGenerator<EnvelopedMessage>,
  trailerTarget: Headers,
  parse: (data: any) => O,
) {
  try {
    let endStreamReceived = false;
    for (;;) {
      const result = await body.next();
      if (result.done) {
        break;
      }
      const { flags, data } = result.value;
      if ((flags & endStreamFlag) === endStreamFlag) {
        endStreamReceived = true;
        const endStream = endStreamFromJson(data);
        if (endStream.error) {
          throw endStream.error;
        }
        endStream.metadata.forEach((value, key) =>
          trailerTarget.set(key, value),
        );
        continue;
      }
      yield parse(data);
    }
    if (!endStreamReceived) {
      throw 'missing EndStreamResponse';
    }
  } catch (e) {
    throw ConnectError.from(e);
  }
}
