import { AdditionalRequestOptions } from './types';
import { createEnvelopeAsyncGenerator } from './envelope';
import { createAsyncGeneratorFromEventPattern } from './async-generator';

export type PartialOptions = Pick<
  WechatMiniprogram.RequestOption,
  'url' | 'header' | 'data'
>;

export interface GeneralEvent<N extends string, T> {
  name: N;
  payload: T;
}

type ChunkReceivedEvent = GeneralEvent<'ChunkReceived', { data: ArrayBuffer }>;
type HeadersReceivedEvent = GeneralEvent<
  'HeadersReceived',
  { header: Record<string, string>; statusCode: number; cookies: string }
>;

type RequestEvent = HeadersReceivedEvent | ChunkReceivedEvent;

export class WeixinRequestError extends Error {
  errno: number;
  constructor(err: WechatMiniprogram.Err) {
    super(err.errMsg);
    this.errno = err.errno;
  }
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
        ...options,
        ...requestOptions,
        method: 'POST',
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

export function createWxRequestAsAsyncGenerator(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  const reqFn = create(request, requestOptions);
  return (options: PartialOptions) => demuxStream(reqFn(options));
}
