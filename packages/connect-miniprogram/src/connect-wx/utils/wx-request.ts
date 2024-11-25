import { headersToObject } from 'headers-polyfill';

import { createEnvelopeAsyncGenerator } from '../../connect/protocol/envelope';
import type {
  AdditionalRequestOptions,
  CreateTransportOptions,
} from '../../types';
import { createAsyncGeneratorFromEventPattern } from './async-generator';

export type PartialOptions = Pick<
  WechatMiniprogram.RequestOption,
  'url' | 'data' | 'method'
> & {
  header?: Headers;
};

export interface GeneralEvent<N extends string, T> {
  name: N;
  payload: T;
}

type ChunkReceivedEvent = GeneralEvent<'ChunkReceived', { data: ArrayBuffer }>;
type HeadersReceivedEvent = GeneralEvent<
  'HeadersReceived',
  { header: Record<string, string>; statusCode: number; cookies: string[] }
>;

type RequestEvent = HeadersReceivedEvent | ChunkReceivedEvent;

export class WeixinRequestError extends Error {
  errno: number;
  constructor(err: WechatMiniprogram.RequestFailCallbackErr) {
    super(err.errMsg);
    this.errno = err.errno;
  }
}

// convert native Headers object to plain object which is supported by wx.request
function convertOptionsWithHeader(options: PartialOptions) {
  const { header, ...rest } = options;
  // Weixin will refuse to send User-Agent header of a request. So we need to delete it before sending the request.
  header?.delete('User-Agent');
  return {
    ...rest,
    ...(header ? { header: headersToObject(header) } : {}),
  };
}

function createWithoutChunked(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  return (options: PartialOptions) => {
    const generator = createAsyncGeneratorFromEventPattern<
      HeadersReceivedEvent | ChunkReceivedEvent
    >(({ handleValue, handleEnd, handleError }) => {
      request({
        ...convertOptionsWithHeader(options),
        ...requestOptions,
        responseType: 'arraybuffer',
        success: ({ header, statusCode, data, cookies }) => {
          handleValue({
            name: 'HeadersReceived',
            payload: { header, statusCode, cookies },
          });
          handleValue({
            name: 'ChunkReceived',
            payload: { data: data as ArrayBuffer },
          });
          handleEnd();
        },
        fail: (e) => handleError(new WeixinRequestError(e)),
      });

      return () => {};
    });

    return generator();
  };
}

function create(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  return (options: PartialOptions) => {
    const generator = createAsyncGeneratorFromEventPattern<
      HeadersReceivedEvent | ChunkReceivedEvent
    >(({ handleValue, handleEnd, handleError }) => {
      const task = request({
        ...convertOptionsWithHeader(options),
        ...requestOptions,
        responseType: 'arraybuffer',
        enableChunked: true,
        success: handleEnd,
        fail: (e) => handleError(new WeixinRequestError(e)),
      });

      task.onChunkReceived((res: any) => {
        handleValue({ name: 'ChunkReceived', payload: res });
      });

      task.onHeadersReceived((res: any) => {
        handleValue({ name: 'HeadersReceived', payload: res });
      });

      return () => {
        task.offChunkReceived();
        task.offHeadersReceived();
      };
    });

    return generator();
  };
}

async function demuxStream(iterator: AsyncGenerator<RequestEvent>) {
  // first value is header
  const headerChunk = (await iterator.next()).value as HeadersReceivedEvent;

  async function* messageStream() {
    for await (const value of iterator) {
      const { payload } = value as ChunkReceivedEvent;
      yield new Uint8Array(payload.data);
    }
  }

  return {
    statusCode: headerChunk.payload.statusCode,
    header: new Headers(headerChunk?.payload.header),
    messageStream: createEnvelopeAsyncGenerator(messageStream()),
  };
}

export function createWxRequestAsAsyncGenerator({
  request,
  isDevTool,
  requestOptions,
}: CreateTransportOptions) {
  /**
   * Weixin devtool has a bug if enableChunked is true.
   * https://developers.weixin.qq.com/community/develop/doc/000e44fc464560a0a6bf4188f56800
   */
  const reqFn = isDevTool
    ? createWithoutChunked(request, requestOptions)
    : create(request, requestOptions);
  return (options: PartialOptions) => demuxStream(reqFn(options));
}

export function createWxRequestAsPromise(
  { request, requestOptions }: CreateTransportOptions,
  useBinaryFormat: boolean,
) {
  return (options: PartialOptions) =>
    new Promise<{ data: any; statusCode: number; header: Headers }>(
      (resolve, reject) => {
        request({
          ...convertOptionsWithHeader(options),
          ...requestOptions,
          responseType: useBinaryFormat ? 'arraybuffer' : 'text',
          success: ({ data, statusCode, header }) =>
            resolve({
              data,
              statusCode,
              header: new Headers(header),
            }),
          fail: reject,
        });
      },
    );
}
