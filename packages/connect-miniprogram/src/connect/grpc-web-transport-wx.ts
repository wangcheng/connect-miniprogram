import type {
  AnyMessage,
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
import {
  createClientMethodSerializers,
  createMethodUrl,
  encodeEnvelope,
} from '@connectrpc/connect/protocol';
import {
  requestHeader,
  validateResponse,
} from '@connectrpc/connect/protocol-grpc-web';
import { headersToObject } from 'headers-polyfill';

import { warnUnsupportedOptions } from './compatbility';
import { createRequestBody } from './message-body/create';
import {
  parseStreamResponseBody,
  parseUaryResponseBody,
} from './message-body/parse-grpc';
import { normalize, normalizeIterable } from './protocol/normalize';
import type { CreateTransportOptions } from './types';
import { createWxRequestAsAsyncGenerator } from './wx-request';

export function createGrpcWebTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? true;

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(options);

  async function unary<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    reqHeader: Record<string, string> | undefined,
    reqMessage: PartialMessage<I>,
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
    const finalHeader = headersToObject(
      requestHeader(useBinaryFormat, timeoutMs, reqHeader),
    );

    const req = encodeEnvelope(0, serialize(normalize(method.I, reqMessage)));

    const { header, messageStream, statusCode } = await requestAsAsyncIterable({
      url,
      header: finalHeader,
      data: req.buffer,
      method: 'POST',
    });

    validateResponse(statusCode, header);

    const { trailer, message } = await parseUaryResponseBody(
      messageStream,
      parse,
    );

    return {
      service,
      method,
      stream: false,
      header,
      trailer,
      message,
    };
  }

  async function stream<I extends Message<I>, O extends Message<O>>(
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
    const reqHeader = headersToObject(
      requestHeader(useBinaryFormat, timeoutMs, header),
    );
    const reqMessage = normalizeIterable(method.I, input);
    const body = await createRequestBody(reqMessage, serialize, method);
    const {
      header: resHeader,
      messageStream,
      statusCode,
    } = await requestAsAsyncIterable({
      url,
      header: reqHeader,
      data: body.buffer,
      method: 'POST',
    });

    const { foundStatus } = validateResponse(statusCode, resHeader);

    const trailerTarget = new Headers();

    const resMessage = await parseStreamResponseBody(
      messageStream,
      foundStatus,
      trailerTarget,
      parse,
    );

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
