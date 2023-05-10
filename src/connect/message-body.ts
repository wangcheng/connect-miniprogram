import { EnvelopedMessage } from '@bufbuild/connect/protocol';
import {
  endStreamFlag,
  endStreamFromJson,
} from '@bufbuild/connect/protocol-connect';
import {
  trailerFlag,
  trailerParse,
  validateTrailer,
} from '@bufbuild/connect/protocol-grpc-web';
import { connectErrorFromReason } from '@bufbuild/connect';
import { encodeEnvelope } from '@bufbuild/connect/protocol';

export async function createRequestBody<I>(
  input: AsyncIterable<I>,
  serialize: (i: I) => Uint8Array,
): Promise<Uint8Array> {
  const r = await input[Symbol.asyncIterator]().next();
  if (r.done == true) {
    throw 'missing request message';
  }
  return encodeEnvelope(0, serialize(r.value));
}

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
    throw connectErrorFromReason(e);
  }
}

export async function* parseGrpcWebResponseBody<O>(
  input: AsyncIterable<EnvelopedMessage>,
  trailerTarget: Headers,
  parse: (data: any) => O,
  foundStatus: boolean,
) {
  try {
    if (foundStatus) {
      // A grpc-status: 0 response header was present. This is a "trailers-only"
      // response (a response without a body and no trailers).
      //
      // The spec seems to disallow a trailers-only response for status 0 - we are
      // lenient and only verify that the body is empty.
      //
      // > [...] Trailers-Only is permitted for calls that produce an immediate error.
      // See https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md
      if (!(await input[Symbol.asyncIterator]().next()).done) {
        throw 'extra data for trailers-only';
      }
      return;
    }
    let trailerReceived = false;
    for await (const chunk of input) {
      const { flags, data } = chunk;

      if ((flags & trailerFlag) === trailerFlag) {
        if (trailerReceived) {
          throw 'extra trailer';
        }
        trailerReceived = true;
        const trailer = trailerParse(data);

        validateTrailer(trailer);
        trailer.forEach((value, key) => trailerTarget.set(key, value));

        continue;
      }
      if (trailerReceived) {
        throw 'extra message';
      }
      yield parse(data);
      continue;
    }
    if (!trailerReceived) {
      throw 'missing trailer';
    }
  } catch (e) {
    throw connectErrorFromReason(e);
  }
}

export async function parseGrpcWebUaryResponseBody<O>(
  input: AsyncIterable<EnvelopedMessage>,
  trailerTarget: Headers,
  parse: (data: any) => O,
) {
  const messageStream = await parseGrpcWebResponseBody(
    input,
    trailerTarget,
    parse,
    false,
  );

  const message = await messageStream.next();

  if (!message.value) {
    throw 'missing message';
  }

  return message.value;
}
