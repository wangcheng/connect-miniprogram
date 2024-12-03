import { jest } from '@jest/globals';

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function fireEventQueue(fns: (() => void)[]) {
  for (const fn of fns) {
    await wait();
    fn();
  }
}

function buffer(arr: number[]) {
  return new Uint8Array(arr).buffer;
}

export const mockWxRequest = ({
  responseHeader = {},
  skipHeadersReceivedHandler = false,
}: {
  responseHeader?: Record<string, string>;
  skipHeadersReceivedHandler?: boolean;
}) => {
  const headerData: Partial<WechatMiniprogram.RequestSuccessCallbackResult> = {
    header: responseHeader,
    statusCode: 200,
    cookies: [],
  };
  return jest.fn((options: WechatMiniprogram.RequestOption) => {
    let chunkReceivedHandler: undefined | ((res: any) => void);
    let headersReceivedHandler: undefined | ((res: any) => void);

    if (options.enableChunked) {
      const eventQueue = [
        () => {
          if (!skipHeadersReceivedHandler) {
            headersReceivedHandler?.(headerData);
          }
        },
        () => {
          chunkReceivedHandler?.({
            data: buffer([1, 2, 3]),
          });
        },
        () => {
          chunkReceivedHandler?.({
            data: buffer([4, 5, 6]),
          });
        },
        () => {
          options.success?.(
            {} as WechatMiniprogram.RequestSuccessCallbackResult,
          );
        },
      ];
      fireEventQueue(eventQueue);
    } else {
      fireEventQueue([
        () => {
          options.success?.({
            ...headerData,
            data: buffer([1, 2, 3, 4, 5, 6]),
          } as WechatMiniprogram.RequestSuccessCallbackResult);
        },
      ]);
    }
    return {
      abort: jest.fn(),
      onChunkReceived: jest.fn((fn: (res: any) => void) => {
        chunkReceivedHandler = fn;
      }),
      offChunkReceived: jest.fn(() => {
        chunkReceivedHandler = undefined;
      }),
      onHeadersReceived: jest.fn((fn: (res: any) => void) => {
        headersReceivedHandler = fn;
      }),
      offHeadersReceived: jest.fn(() => {
        headersReceivedHandler = undefined;
      }),
    } as WechatMiniprogram.RequestTask;
  }) as typeof wx.request;
};
