import { fromEventPattern } from 'ix/asynciterable/fromeventpattern';
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
import { Code, connectErrorFromReason, ConnectError } from '@bufbuild/connect';

import { AdditionalRequestOptions } from './types';

type ChunkOrHeader = Headers | Uint8Array;

type PartialOptions = Pick<
  WechatMiniprogram.RequestOption,
  'url' | 'header' | 'data'
>;

function createWxRequestAsAsyncIterable(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  return async function* wxRequestToAsyncIterable(
    options: PartialOptions,
  ): AsyncIterable<ChunkOrHeader> {
    let task: WechatMiniprogram.RequestTask;

    const asyncIterable: AsyncIterable<{
      header?: any;
      data?: ArrayBuffer;
      done?: true;
      error?: WechatMiniprogram.Err;
    }> = fromEventPattern(
      (handler) => {
        task = request({
          ...options,
          ...requestOptions,
          method: 'POST',
          responseType: 'arraybuffer',
          enableChunked: true,
          success: () => {
            handler({ done: true });
          },
          fail: (error) => {
            handler({ done: true, error });
          },
        });
        task.onChunkReceived(handler);
        task.onHeadersReceived(handler);
      },
      (handler) => {
        task.offChunkReceived(handler);
        task.offHeadersReceived(handler);
      },
    );

    for await (const res of asyncIterable) {
      if (res.done) {
        break;
      }
      if (res.error) {
        throw res.error;
      }
      if (res.data instanceof ArrayBuffer) {
        yield new Uint8Array(res.data);
      }
      yield new Headers(res.header);
    }
  };
}

async function* parseEnvelope(
  input: AsyncIterable<ChunkOrHeader>,
): AsyncIterable<EnvelopedMessage> {
  let buffer = new Uint8Array(0);

  function append(chunk: Uint8Array) {
    const n = new Uint8Array(buffer.length + chunk.length);
    n.set(buffer);
    n.set(chunk, buffer.length);
    buffer = n;
  }

  for await (const chunk of input) {
    if (chunk instanceof Headers) {
      continue;
    }
    append(chunk);

    let header: { length: number; flags: number } | undefined;
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

  if (buffer.byteLength > 0) {
    throw new ConnectError('premature end of stream', Code.DataLoss);
  }
}

export async function* parseResponseBody<O>(
  input: AsyncIterable<EnvelopedMessage>,
  trailerTarget: Headers,
  parse: (data: any) => O,
): AsyncIterable<O> {
  try {
    let endStreamReceived = false;
    for await (const chunk of input) {
      const { flags, data } = chunk;
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

export function createRequestAsAsyncIterable(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  const reqFn = createWxRequestAsAsyncIterable(request, requestOptions);
  return (options: PartialOptions) => {
    const rawRes = reqFn(options);
    const stream = parseEnvelope(rawRes);
    /**
     * resolve when header is recieved.
     */
    return rawRes[Symbol.asyncIterator]()
      .next()
      .then(({ value }) => ({
        header: value,
        stream,
      }));
  };
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
  parse: (data: any) => O,
) {
  const trailerTarget = new Headers();
  const res = parseGrpcWebResponseBody(input, trailerTarget, parse, false);
  let message: O | undefined;

  for await (const chunk of res) {
    if (!message) {
      message = chunk;
    }
  }

  if (!message) {
    throw 'missing message';
  }

  return { message, trailer: trailerTarget };
}
