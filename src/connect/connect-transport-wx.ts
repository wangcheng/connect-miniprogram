import type {
  AnyMessage,
  JsonValue,
  Message,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import type {
  StreamResponse,
  Transport,
  UnaryResponse,
} from '@connectrpc/connect';
import { appendHeaders } from '@connectrpc/connect';
import {
  createClientMethodSerializers,
  createMethodUrl,
} from '@connectrpc/connect/protocol';
import {
  errorFromJson,
  requestHeader,
  trailerDemux,
  validateResponse,
} from '@connectrpc/connect/protocol-connect';
import { headersToObject, objectToHeaders } from 'headers-polyfill';

import { createRequestBody } from './message-body/create';
import { parseResponseBody } from './message-body/parse-connect';
import { normalize, normalizeIterable } from './protocal/normalize';
import type { CreateTransportOptions } from './types';
import {
  createWxRequestAsAsyncGenerator,
  createWxRequestAsPromise,
} from './wx-request';

export function createConnectTransport(
  options: CreateTransportOptions,
): Transport {
  const request = createWxRequestAsPromise(options);

  const useBinaryFormat = options.useBinaryFormat ?? false;
  async function unary<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    message: PartialMessage<I>,
  ): Promise<UnaryResponse<I, O>> {
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

    // runUnaryCall
    const url = createMethodUrl(options.baseUrl, service, method);

    const reqHeaders = requestHeader(
      method.kind,
      useBinaryFormat,
      timeoutMs,
      header,
    );

    const reqMessage = normalize(method.I, message);

    const body = serialize(reqMessage);

    const response = await request({
      url,
      header: headersToObject(reqHeaders),
      data: body.buffer,
    });

    const resHeaders = objectToHeaders(response.header);
    const { isUnaryError, unaryError } = validateResponse(
      method.kind,
      response.statusCode,
      resHeaders,
    );
    if (isUnaryError) {
      throw errorFromJson(
        response.data as JsonValue,
        appendHeaders(...trailerDemux(resHeaders)),
        unaryError,
      );
    }
    const [demuxedHeader, demuxedTrailer] = trailerDemux(resHeaders);
    const result: UnaryResponse<I, O> = {
      service,
      header: demuxedHeader as any as Headers,
      trailer: demuxedTrailer as any as Headers,
      stream: false,
      method,
      message: parse(new Uint8Array(response.data as ArrayBuffer)),
    };
    return result;
  }

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(options);

  async function stream<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: HeadersInit | undefined,
    input: AsyncIterable<PartialMessage<I>>,
  ): Promise<StreamResponse<I, O>> {
    const { serialize, parse } = createClientMethodSerializers(
      method,
      useBinaryFormat,
      options.jsonOptions,
      options.binaryOptions,
    );

    const url = createMethodUrl(options.baseUrl, service, method);
    const reqHeader = headersToObject(
      requestHeader(method.kind, useBinaryFormat, timeoutMs, header),
    );
    const reqMessage = normalizeIterable(method.I, input);
    const body = await createRequestBody(reqMessage, serialize, method);
    const { header: resHeader, messageStream } = await requestAsAsyncIterable({
      url,
      header: reqHeader,
      data: body.buffer,
    });
    const trailerTarget = new Headers();
    return {
      service,
      method,
      stream: true,
      header: resHeader,
      trailer: trailerTarget,
      message: parseResponseBody(messageStream, trailerTarget, parse),
    };
  }

  return {
    unary,
    stream,
  };
}
