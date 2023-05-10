import { headersToObject } from 'headers-polyfill';
import { Message } from '@bufbuild/protobuf';
import type {
  AnyMessage,
  JsonValue,
  MethodInfo,
  PartialMessage,
  ServiceType,
} from '@bufbuild/protobuf';
import {
  Code,
  appendHeaders,
  connectErrorFromReason,
  runUnary,
  runStreaming,
} from '@bufbuild/connect';
import type {
  StreamResponse,
  Transport,
  UnaryResponse,
  UnaryRequest,
} from '@bufbuild/connect';
import {
  createClientMethodSerializers,
  createMethodUrl,
} from '@bufbuild/connect/protocol';
import {
  requestHeader,
  validateResponse,
  trailerDemux,
  errorFromJson,
} from '@bufbuild/connect/protocol-connect';

import { createWxRequestAsAsyncGenerator } from './wx-request';
import { parseResponseBody, createRequestBody } from './message-body';

import { CreateTransportOptions } from './types';

export function createConnectTransport(
  options: CreateTransportOptions,
): Transport {
  const useBinaryFormat = options.useBinaryFormat ?? false;
  async function unary<
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
    return await runUnary<I, O>(
      {
        stream: false,
        service,
        method,
        url: createMethodUrl(options.baseUrl, service, method),
        init: {},
        header: requestHeader(method.kind, useBinaryFormat, timeoutMs, header),
        message: normalize(message),
        signal: _signal as AbortSignal,
      },
      (req: UnaryRequest<I, O>): Promise<UnaryResponse<I, O>> =>
        new Promise<WechatMiniprogram.RequestSuccessCallbackResult>(
          (resolve, reject) => {
            options.request({
              url: req.url,
              header: headersToObject(req.header),
              method: 'POST',
              data: serialize(req.message).buffer,
              responseType: 'arraybuffer',
              ...options.requestOptions,
              success: resolve,
              fail: (e) => {
                reject(connectErrorFromReason(e, Code.Internal));
              },
            });
          },
        ).then((res) => {
          const headers = new Headers(res.header);
          const { isUnaryError, unaryError } = validateResponse(
            method.kind,
            useBinaryFormat,
            res.statusCode,
            headers,
          );
          if (isUnaryError) {
            throw errorFromJson(
              res.data as JsonValue,
              appendHeaders(...trailerDemux(headers)),
              unaryError,
            );
          }
          const [demuxedHeader, demuxedTrailer] = trailerDemux(headers);
          const result: UnaryResponse<I, O> = {
            service,
            header: demuxedHeader as any as Headers,
            trailer: demuxedTrailer as any as Headers,
            stream: false,
            method,
            message: parse(new Uint8Array(res.data as ArrayBuffer)),
          };
          return result;
        }),
      [],
    );
  }

  const requestAsAsyncIterable = createWxRequestAsAsyncGenerator(
    options.request,
    options.requestOptions,
  );

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
    return runStreaming<I, O>(
      {
        stream: true,
        service,
        method,
        url: createMethodUrl(options.baseUrl, service, method),
        init: {},
        signal: _signal as AbortSignal,
        header: requestHeader(
          method.kind,
          useBinaryFormat,
          timeoutMs,
          reqHeader,
        ),
        message,
      },
      async (req) => {
        const body = await createRequestBody(message, serialize, method);
        const { header, messageStream } = await requestAsAsyncIterable({
          url: req.url,
          header: headersToObject(req.header),
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
      },
      [],
    );
  }

  return {
    unary,
    stream,
  };
}
