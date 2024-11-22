/**
 * @see https://github.com/connectrpc/connect-es/blob/main/packages/connect-web/src/grpc-web-transport.ts
 */

import type {
  DescMessage,
  DescMethodStreaming,
  DescMethodUnary,
  MessageInitShape,
  MessageShape,
} from '@bufbuild/protobuf';
import type {
  ContextValues,
  StreamResponse,
  Transport,
  UnaryResponse,
} from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';
import type { EnvelopedMessage } from '@connectrpc/connect/protocol';
import {
  compressedFlag,
  createClientMethodSerializers,
  createMethodUrl,
  encodeEnvelope,
} from '@connectrpc/connect/protocol';
import {
  headerGrpcStatus,
  requestHeader,
  trailerFlag,
  trailerParse,
  validateResponse,
  validateTrailer,
} from '@connectrpc/connect/protocol-grpc-web';

import { warnUnsupportedOptions } from './compatbility';
import { normalize, normalizeIterable } from './protocol/normalize';
import type { CreateTransportOptions } from './types';
import { createWxRequestAsAsyncGenerator } from './wx-request';

export function createGrpcWebTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? true;

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(options);

  return {
    async unary<I extends DescMessage, O extends DescMessage>(
      method: DescMethodUnary<I, O>,
      signal: AbortSignal | undefined,
      timeoutMs: number | undefined,
      header: Record<string, string> | undefined,
      message: MessageInitShape<I>,
      contextValues?: ContextValues,
    ): Promise<UnaryResponse<I, O>> {
      warnUnsupportedOptions(signal, contextValues);

      const { serialize, parse } = createClientMethodSerializers(
        method,
        useBinaryFormat,
        options.jsonOptions,
        options.binaryOptions,
      );

      timeoutMs =
        timeoutMs === undefined
          ? options.defaultTimeoutMs
          : timeoutMs <= 0
            ? undefined
            : timeoutMs;

      const url = createMethodUrl(options.baseUrl, method);
      const reqHeader = requestHeader(
        useBinaryFormat,
        timeoutMs,
        header,
        false,
      );
      // normalize message @see https://github.com/connectrpc/connect-es/blob/main/packages/connect/src/protocol/run-call.ts
      const reqMessage = normalize(method.input, message);
      const req = encodeEnvelope(0, serialize(reqMessage));

      const response = await requestAsAsyncIterable({
        url,
        header: reqHeader,
        data: req.buffer,
        method: 'POST',
      });

      const { headerError } = validateResponse(
        response.statusCode,
        response.header,
      );

      if (!response.messageStream) {
        if (headerError !== undefined) throw headerError;
        throw 'missing response body';
      }

      let resTrailer: Headers | undefined;
      let resMessage: MessageShape<O> | undefined;
      for await (const chunk of response.messageStream) {
        const { flags, data } = chunk;
        if ((flags & compressedFlag) === compressedFlag) {
          throw new ConnectError(
            `protocol error: received unsupported compressed output`,
            Code.Internal,
          );
        }
        if (flags === trailerFlag) {
          if (resTrailer !== undefined) {
            throw 'extra trailer';
          }
          // Unary responses require exactly one response message, but in
          // case of an error, it is perfectly valid to have a response body
          // that only contains error trailers.
          resTrailer = trailerParse(data);
          continue;
        }
        if (resMessage !== undefined) {
          throw new ConnectError('extra message', Code.Unimplemented);
        }
        resMessage = parse(data);
      }
      if (resTrailer === undefined) {
        if (headerError !== undefined) throw headerError;
        throw new ConnectError(
          'missing trailer',
          response.header.has(headerGrpcStatus)
            ? Code.Unimplemented
            : Code.Unknown,
        );
      }
      validateTrailer(resTrailer, response.header);
      if (resMessage === undefined) {
        throw new ConnectError(
          'missing message',
          resTrailer.has(headerGrpcStatus) ? Code.Unimplemented : Code.Unknown,
        );
      }

      return {
        stream: false,
        service: method.parent,
        method,
        header: response.header,
        message: resMessage,
        trailer: resTrailer,
      };
    },

    async stream<I extends DescMessage, O extends DescMessage>(
      method: DescMethodStreaming<I, O>,
      signal: AbortSignal | undefined,
      timeoutMs: number | undefined,
      header: HeadersInit | undefined,
      input: AsyncIterable<MessageInitShape<I>>,
      contextValues?: ContextValues,
    ): Promise<StreamResponse<I, O>> {
      warnUnsupportedOptions(signal, contextValues);

      const { serialize, parse } = createClientMethodSerializers(
        method,
        useBinaryFormat,
        options.jsonOptions,
        options.binaryOptions,
      );

      async function* parseResponseBody(
        input: AsyncGenerator<EnvelopedMessage>,
        foundStatus: boolean,
        trailerTarget: Headers,
        header: Headers,
      ) {
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

            validateTrailer(trailer, header);
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
      }

      async function createRequestBody(
        input: AsyncIterable<MessageShape<I>>,
      ): Promise<Uint8Array> {
        if (method.methodKind != 'server_streaming') {
          throw 'Weixin does not support streaming request bodies';
        }
        const r = await input[Symbol.asyncIterator]().next();
        if (r.done == true) {
          throw 'missing request message';
        }
        return encodeEnvelope(0, serialize(r.value));
      }

      timeoutMs =
        timeoutMs === undefined
          ? options.defaultTimeoutMs
          : timeoutMs <= 0
            ? undefined
            : timeoutMs;

      const url = createMethodUrl(options.baseUrl, method);
      const reqHeader = requestHeader(
        useBinaryFormat,
        timeoutMs,
        header,
        false,
      );
      const reqMessage = normalizeIterable(method.input, input);
      const body = await createRequestBody(reqMessage);
      const response = await requestAsAsyncIterable({
        url,
        header: reqHeader,
        data: body.buffer,
        method: 'POST',
      });

      const { foundStatus, headerError } = validateResponse(
        response.statusCode,
        response.header,
      );

      if (headerError != undefined) {
        throw headerError;
      }

      if (!response.messageStream) {
        throw 'missing response body';
      }

      const trailerTarget = new Headers();

      const resMessage = await parseResponseBody(
        response.messageStream,
        foundStatus,
        trailerTarget,
        response.header,
      );

      return {
        service: method.parent,
        method,
        stream: true,
        header: response.header,
        trailer: trailerTarget,
        message: resMessage,
      };
    },
  };
}
