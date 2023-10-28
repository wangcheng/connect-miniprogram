import type {
  AnyMessage,
  JsonValue,
  Message,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import type {
  ContextValues,
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
import { headersToObject } from 'headers-polyfill';

import { warnUnsupportedOptions } from './compatbility';
import { createRequestBody } from './message-body/create';
import { parseResponseBody } from './message-body/parse-connect';
import { normalize, normalizeIterable } from './protocol/normalize';
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
    );

    const reqMessage = normalize(method.I, message);

    const body = serialize(reqMessage);

    const response = await request({
      url,
      header: headersToObject(reqHeader),
      data: body.buffer,
      method: 'POST',
    });

    const resHeader = response.header;
    const { isUnaryError, unaryError } = validateResponse(
      method.kind,
      response.statusCode,
      resHeader,
    );
    if (isUnaryError) {
      throw errorFromJson(
        response.data as JsonValue,
        appendHeaders(...trailerDemux(resHeader)),
        unaryError,
      );
    }
    const [demuxedHeader, demuxedTrailer] = trailerDemux(resHeader);
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
    );
    const reqMessage = normalizeIterable(method.I, input);
    const body = await createRequestBody(reqMessage, serialize, method);
    const { header: resHeader, messageStream } = await requestAsAsyncIterable({
      url,
      header: headersToObject(reqHeader),
      data: body.buffer,
      method: 'POST',
    });
    const trailerTarget = new Headers();
    const resMessage = parseResponseBody(messageStream, trailerTarget, parse);
    return {
      service,
      method,
      stream: true,
      header: resHeader,
      trailer: trailerTarget,
      message: resMessage,
    };
  }

  return {
    unary,
    stream,
  };
}
