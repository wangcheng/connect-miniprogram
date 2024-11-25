import { describe, expect, jest, test } from '@jest/globals';

import {
  createWxRequestAsAsyncGenerator,
  createWxRequestAsPromise,
} from './wx-request';

jest.mock('../protocol/envelope', () => ({
  createEnvelopeAsyncGenerator: (s) => s,
}));

const wxRequest = jest.fn((options: WechatMiniprogram.RequestOption) => {
  let chunkReceivedHandler: undefined | ((res: any) => void);
  let headersReceivedHandler: undefined | ((res: any) => void);
  const result: Partial<WechatMiniprogram.RequestSuccessCallbackResult> = {
    header: {
      'response-header-key': 'response-header-value',
    },
    statusCode: 200,
    cookies: [],
  };
  if (options.enableChunked) {
    setTimeout(() => {
      headersReceivedHandler?.(result);
      setTimeout(() => {
        chunkReceivedHandler?.('chunk1');
        setTimeout(() => {
          chunkReceivedHandler?.('chunk2');
          options.success?.(
            {} as WechatMiniprogram.RequestSuccessCallbackResult,
          );
        }, 0);
      }, 0);
    }, 0);
  } else {
    setTimeout(() => {
      options.success?.({
        ...result,
        data: 'chunk1chunk2',
      } as WechatMiniprogram.RequestSuccessCallbackResult);
    }, 0);
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

describe('createWxRequestAsPromise', () => {
  test('should return a promise, using binary format', () => {
    const request = createWxRequestAsPromise(
      {
        request: wxRequest,
        requestOptions: {
          forceCellularNetwork: true,
        },
      },
      true,
    );
    const header = new Headers();
    header.append('foo', 'bar');
    request({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header,
    });
    expect(wxRequest).toBeCalledWith({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header: {
        foo: 'bar',
      },
      responseType: 'arraybuffer',
      forceCellularNetwork: true,
      fail: expect.any(Function),
      success: expect.any(Function),
    });
  });
});

describe('createWxRequestAsAsyncGenerator', () => {
  test('should return an async generator, not devtool', async () => {
    const request = createWxRequestAsAsyncGenerator({
      request: wxRequest,
      isDevTool: false,
      requestOptions: {
        forceCellularNetwork: true,
      },
    });
    const reqHeaders = new Headers();
    reqHeaders.append('foo', 'bar');
    const {
      header: resHeader,
      statusCode,
      messageStream,
    } = await request({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header: reqHeaders,
    });
    expect(wxRequest).toBeCalledWith({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header: {
        foo: 'bar',
      },
      responseType: 'arraybuffer',
      forceCellularNetwork: true,
      fail: expect.any(Function),
      success: expect.any(Function),
    });

    expect(resHeader.get('response-header-key')).toBe('response-header-value');
    expect(statusCode).toBe(200);
    expect(await messageStream.next()).toEqual({
      done: false,
      value: expect.any(Uint8Array),
    });
    expect(await messageStream.next()).toEqual({
      done: false,
      value: expect.any(Uint8Array),
    });
    expect(await messageStream.next()).toEqual({
      done: true,
      value: undefined,
    });
  });

  test('should return an async generator, is devtool', async () => {
    const request = createWxRequestAsAsyncGenerator({
      request: wxRequest,
      isDevTool: true,
      requestOptions: {
        forceCellularNetwork: true,
      },
    });
    const reqHeaders = new Headers();
    reqHeaders.append('foo', 'bar');
    const {
      header: resHeader,
      statusCode,
      messageStream,
    } = await request({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header: reqHeaders,
    });
    expect(wxRequest).toBeCalledWith({
      url: 'https://example.com',
      data: 'data',
      method: 'POST',
      header: {
        foo: 'bar',
      },
      responseType: 'arraybuffer',
      forceCellularNetwork: true,
      fail: expect.any(Function),
      success: expect.any(Function),
    });
    expect(resHeader.get('response-header-key')).toBe('response-header-value');
    expect(statusCode).toBe(200);
    expect(await messageStream.next()).toEqual({
      done: false,
      value: expect.any(Uint8Array),
    });
    expect(await messageStream.next()).toEqual({
      done: true,
      value: undefined,
    });
  });
});
