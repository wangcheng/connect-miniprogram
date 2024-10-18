/**
 * @see https://github.com/connectrpc/connect-es/blob/main/packages/connect-web/src/connect-transport.ts
 */

import type {
  AnyMessage,
  JsonValue,
  Message,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import { MethodKind } from '@bufbuild/protobuf';
import type {
  ContextValues,
  StreamResponse,
  Transport,
  UnaryResponse,
} from '@connectrpc/connect';
import { appendHeaders, Code, ConnectError } from '@connectrpc/connect';
import type { EnvelopedMessage } from '@connectrpc/connect/protocol';
import {
  compressedFlag,
  createClientMethodSerializers,
  createMethodUrl,
  encodeEnvelope,
  getJsonOptions,
} from '@connectrpc/connect/protocol';
import {
  endStreamFlag,
  endStreamFromJson,
  errorFromJson,
  requestHeader,
  trailerDemux,
  validateResponse,
} from '@connectrpc/connect/protocol-connect';

import { warnUnsupportedOptions } from './compatbility';
import { normalize, normalizeIterable } from './protocol/normalize';
import type { CreateTransportOptions } from './types';
import {
  createWxRequestAsAsyncGenerator,
  createWxRequestAsPromise,
} from './wx-request';

export function createConnectTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? false;

  const requestAsPromise = createWxRequestAsPromise(options, useBinaryFormat);
  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(options);

  async function unary<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    message: PartialMessage<I>,
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

    const url = createMethodUrl(options.baseUrl, service, method);

    const reqHeader = requestHeader(
      method.kind,
      useBinaryFormat,
      timeoutMs,
      header,
      false,
    );

    reqHeader.delete('User-Agent');

    // start of custom code
    // `normalize` is called in `runUnaryCall` in the upstream implementation. becuase we don't support runUnaryCall, we need to call normalize here
    const reqMessage = normalize(method.I, message);

    const body = serialize(reqMessage);

    const response = await requestAsPromise({
      url,
      header: reqHeader,
      data: body.buffer,
      method: 'POST',
    });
    // end of custom code

    const { isUnaryError, unaryError } = validateResponse(
      method.kind,
      response.statusCode,
      response.header,
    );
    if (isUnaryError) {
      throw errorFromJson(
        response.data as JsonValue,
        appendHeaders(...trailerDemux(response.header)),
        unaryError,
      );
    }
    const [demuxedHeader, demuxedTrailer] = trailerDemux(response.header);
    const result: UnaryResponse<I, O> = {
      stream: false,
      service,
      method,
      header: demuxedHeader,
      message: useBinaryFormat
        ? parse(new Uint8Array(response.data as ArrayBuffer))
        : method.O.fromJson(
            response.data as string,
            getJsonOptions(options.jsonOptions),
          ),
      trailer: demuxedTrailer,
    };
    return result;
  }

  async function stream<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    input: AsyncIterable<PartialMessage<I>>,
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
      body: AsyncGenerator<EnvelopedMessage>,
      trailerTarget: Headers,
      header: Headers,
    ) {
      try {
        let endStreamReceived = false;
        for (;;) {
          const result = await body.next();
          if (result.done) {
            break;
          }
          const { flags, data } = result.value;
          if ((flags & compressedFlag) === compressedFlag) {
            throw new ConnectError(
              `protocol error: received unsupported compressed output`,
              Code.Internal,
            );
          }
          if ((flags & endStreamFlag) === endStreamFlag) {
            endStreamReceived = true;
            const endStream = endStreamFromJson(data);
            if (endStream.error) {
              const error = endStream.error;
              header.forEach((value, key) => {
                error.metadata.append(key, value);
              });
              throw error;
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

    async function createRequestBody(
      input: AsyncIterable<I>,
    ): Promise<Uint8Array> {
      if (method.kind != MethodKind.ServerStreaming) {
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

    const url = createMethodUrl(options.baseUrl, service, method);
    const reqHeader = requestHeader(
      method.kind,
      useBinaryFormat,
      timeoutMs,
      header,
      false,
    );

    reqHeader.delete('User-Agent');

    const reqMessage = normalizeIterable(method.I, input);
    const body = await createRequestBody(reqMessage);
    const response = await requestAsAsyncIterable({
      url,
      header: reqHeader,
      data: body.buffer,
      method: 'POST',
    });
    const trailerTarget = new Headers();
    const resMessage = parseResponseBody(
      response.messageStream,
      trailerTarget,
      response.header,
    );
    return {
      service,
      method,
      stream: true,
      header: response.header,
      trailer: trailerTarget,
      message: resMessage,
    };
  }

  return {
    unary,
    stream,
  };
}
