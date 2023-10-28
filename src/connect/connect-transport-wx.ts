import type {
  StreamResponse,
  Transport,
  UnaryResponse,
} from '@bufbuild/connect';
import { appendHeaders, Code, ConnectError } from '@bufbuild/connect';
import {
  createClientMethodSerializers,
  createMethodUrl,
} from '@bufbuild/connect/protocol';
import {
  errorFromJson,
  requestHeader,
  trailerDemux,
  validateResponse,
} from '@bufbuild/connect/protocol-connect';
import type {
  AnyMessage,
  JsonValue,
  Message,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import { headersToObject } from 'headers-polyfill';

import { createRequestBody } from './message-body/create';
import { parseResponseBody } from './message-body/parse-connect';
import type { CreateTransportOptions } from './types';
import { createWxRequestAsAsyncGenerator } from './wx-request';

export function createConnectTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? false;
  function unary<
    I extends Message<I> = AnyMessage,
    O extends Message<O> = AnyMessage,
  >(
    service: ServiceType,
    method: MethodInfo<I, O>,
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: Record<string, string> | undefined,
    message: PartialMessage<I>,
  ): Promise<UnaryResponse<I, O>> {
    const { normalize, serialize, parse } = createClientMethodSerializers(
      method,
      useBinaryFormat,
      options.jsonOptions,
      options.binaryOptions,
    );
    const url = createMethodUrl(options.baseUrl, service, method);
    const finalHeader = headersToObject(
      requestHeader(method.kind, useBinaryFormat, timeoutMs, header),
    );

    const req = serialize(normalize(message));
    return new Promise<UnaryResponse<I, O>>((resolve, reject) => {
      const onSuccess = (response) => {
        const headers = new Headers(response.header);
        const { isUnaryError, unaryError } = validateResponse(
          method.kind,
          response.statusCode,
          headers,
        );
        if (isUnaryError) {
          reject(
            errorFromJson(
              response.data as JsonValue,
              appendHeaders(...trailerDemux(headers)),
              unaryError,
            ),
          );
        }
        const [demuxedHeader, demuxedTrailer] = trailerDemux(headers);
        const result: UnaryResponse<I, O> = {
          service,
          header: demuxedHeader as any as Headers,
          trailer: demuxedTrailer as any as Headers,
          stream: false,
          method,
          message: parse(new Uint8Array(response.data as ArrayBuffer)),
        };
        resolve(result);
      };

      options.request({
        url,
        header: finalHeader,
        method: 'POST',
        data: req.buffer,
        responseType: 'arraybuffer',
        ...options.requestOptions,
        success: onSuccess,
        fail: (e) => {
          reject(ConnectError.from(e, Code.Internal));
        },
      });
    });
  }

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(options);

  async function stream<I extends Message<I>, O extends Message<O>>(
    service: ServiceType,
    method: MethodInfo<I, O>,
    _signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    reqHeader: HeadersInit | undefined,
    message: AsyncIterable<I>,
  ): Promise<StreamResponse<I, O>> {
    const { serialize, parse } = createClientMethodSerializers(
      method,
      useBinaryFormat,
      options.jsonOptions,
      options.binaryOptions,
    );

    const url = createMethodUrl(options.baseUrl, service, method);
    const finalHeader = headersToObject(
      requestHeader(method.kind, useBinaryFormat, timeoutMs, reqHeader),
    );
    const body = await createRequestBody(message, serialize, method);
    const { header, messageStream } = await requestAsAsyncIterable({
      url,
      header: finalHeader,
      data: body.buffer,
    });
    const trailerTarget = new Headers();
    return {
      service,
      method,
      stream: true,
      header,
      trailer: trailerTarget,
      message: parseResponseBody(messageStream, trailerTarget, parse),
    };
  }

  return {
    unary,
    stream,
  };
}
