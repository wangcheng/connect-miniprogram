import { headersToObject } from 'headers-polyfill';
import { Message } from '@bufbuild/protobuf';
import type {
  AnyMessage,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import type {
  StreamResponse,
  Transport,
  UnaryResponse,
} from '@bufbuild/connect';
import {
  createClientMethodSerializers,
  createMethodUrl,
  encodeEnvelope,
} from '@bufbuild/connect/protocol';
import {
  requestHeader,
  validateResponse,
} from '@bufbuild/connect/protocol-grpc-web';

import { CreateTransportOptions } from './types';
import { createWxRequestAsAsyncGenerator } from './wx-request';
import {
  parseStreamResponseBody,
  parseUaryResponseBody,
} from './message-body/parse-grpc';
import { createRequestBody } from './message-body/create';

export function createGrpcWebTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? true;

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(
    options.request,
    options.requestOptions,
  );

  async function unary<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    reqHeader: Record<string, string> | undefined,
    reqMessage: PartialMessage<I>,
  ): Promise<UnaryResponse<I, O>> {
    const { normalize, serialize, parse } = createClientMethodSerializers(
      method,
      useBinaryFormat,
      options.jsonOptions,
      options.binaryOptions,
    );
    const url = createMethodUrl(options.baseUrl, service, method);
    const finalHeader = headersToObject(
      requestHeader(useBinaryFormat, timeoutMs, reqHeader),
    );

    const req = encodeEnvelope(0, serialize(normalize(reqMessage)));

    const { header, messageStream, statusCode } = await requestAsAsyncIterable({
      url,
      header: finalHeader,
      data: req.buffer,
    });

    validateResponse(useBinaryFormat, statusCode, header);

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
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    reqHeader: HeadersInit | undefined,
    reqMessage: AsyncIterable<I>,
  ): Promise<StreamResponse<I, O>> {
    const { serialize, parse } = createClientMethodSerializers(
      method,
      useBinaryFormat,
      options.jsonOptions,
      options.binaryOptions,
    );

    const url = createMethodUrl(options.baseUrl, service, method);
    const finalHeader = headersToObject(
      requestHeader(useBinaryFormat, timeoutMs, reqHeader),
    );
    const body = await createRequestBody(reqMessage, serialize, method);
    const { header, messageStream, statusCode } = await requestAsAsyncIterable({
      url,
      header: finalHeader,
      data: body.buffer,
    });

    const { foundStatus } = validateResponse(
      useBinaryFormat,
      statusCode,
      header,
    );

    const trailerTarget = new Headers();

    const message = await parseStreamResponseBody(
      messageStream,
      foundStatus,
      trailerTarget,
      parse,
    );

    return {
      service,
      method,
      stream: true,
      header,
      trailer: trailerTarget,
      message,
    };
  }

  return {
    unary,
    stream,
  };
}
