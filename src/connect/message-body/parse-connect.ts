import { ConnectError } from '@bufbuild/connect';
import type { EnvelopedMessage } from '@bufbuild/connect/protocol';
import {
  endStreamFlag,
  endStreamFromJson,
} from '@bufbuild/connect/protocol-connect';

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
