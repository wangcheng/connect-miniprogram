import { fromEventPattern } from 'ix/asynciterable/fromeventpattern';

import { AdditionalRequestOptions } from './types';
import { createEnvelopeAsyncGenerator } from './envelope';

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
  { header: Record<string, string> }
>;

type RequestEvent =
  | HeadersReceivedEvent
  | ChunkReceivedEvent
  | GeneralEvent<'Success', WechatMiniprogram.RequestSuccessCallbackResult>
  | GeneralEvent<'Fail', WechatMiniprogram.Err>;

function create(
  request: typeof wx.request,
  requestOptions?: AdditionalRequestOptions,
) {
  return async function* wxRequestToAsyncIterable(options: PartialOptions) {
    let task: WechatMiniprogram.RequestTask;

    const asyncIterable: AsyncIterable<RequestEvent> = fromEventPattern(
      (handler) => {
        task = request({
          ...options,
          ...requestOptions,
          method: 'POST',
          responseType: 'arraybuffer',
          enableChunked: true,
          success: (res) => {
            handler({ name: 'Success', payload: res });
          },
          fail: (error) => {
            handler({ name: 'Fail', payload: error });
          },
        });
        task.onChunkReceived((res) =>
          handler({ name: 'ChunkReceived', payload: res }),
        );
        task.onHeadersReceived((res) =>
          handler({ name: 'HeadersReceived', payload: res }),
        );
      },
      () => {
        task.offChunkReceived();
        task.offHeadersReceived();
      },
    );

    for await (const res of asyncIterable) {
      if (res.name === 'Success') {
        break;
      }
      if (res.name === 'Fail') {
        throw res.payload;
      }
      yield res;
    }
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
    header: new Headers(headerChunk.payload.header),
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
