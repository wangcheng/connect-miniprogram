import { EnvelopedMessage } from '@bufbuild/connect/protocol';
import {
  trailerFlag,
  trailerParse,
  validateTrailer,
} from '@bufbuild/connect/protocol-grpc-web';
import { connectErrorFromReason } from '@bufbuild/connect';

export async function* parseStreamResponseBody<O>(
  input: AsyncGenerator<EnvelopedMessage>,
  foundStatus: boolean,
  trailerTarget: Headers,
  parse: (data: any) => O,
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
      if (!(await input.next()).done) {
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

export async function parseUaryResponseBody<O>(
  input: AsyncGenerator<EnvelopedMessage>,
  parse: (data: any) => O,
) {
  let trailer: Headers | undefined;
  let message: O | undefined;
  for await (const chunk of input) {
    const { flags, data } = chunk;
    // FIXME: the original code is "flags === trailerFlag". it doesn't work. the real flags is 253
    if ((flags & trailerFlag) === trailerFlag) {
      if (trailer !== undefined) {
        throw 'extra trailer';
      }
      // Unary responses require exactly one response message, but in
      // case of an error, it is perfectly valid to have a response body
      // that only contains error trailers.
      trailer = trailerParse(data);
      continue;
    }
    if (message !== undefined) {
      throw 'extra message';
    }
    message = parse(data);
  }
  if (trailer === undefined) {
    throw 'missing trailer';
  }
  validateTrailer(trailer);
  if (message === undefined) {
    throw 'missing message';
  }

  return { trailer, message };
}
