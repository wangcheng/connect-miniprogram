import { describe, expect, jest, test } from '@jest/globals';

import { mockWxRequest } from '../test-utils';
import {
  createWxRequestAsAsyncGenerator,
  createWxRequestAsPromise,
} from './wx-request';

jest.mock('./envelope', () => ({
  createEnvelopeAsyncGenerator: (s) => s,
}));

describe('createWxRequestAsPromise', () => {
  test('should return a promise, using binary format', () => {
    const wxRequest = mockWxRequest({});
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
    const wxRequest = mockWxRequest({
      responseHeader: {
        'response-header-key': 'response-header-value',
      },
    });
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
      enableChunked: true,
      responseType: 'arraybuffer',
      forceCellularNetwork: true,
      fail: expect.any(Function),
      success: expect.any(Function),
    });

    expect(resHeader.get('response-header-key')).toBe('response-header-value');
    expect(statusCode).toBe(200);
    expect(await messageStream.next()).toEqual({
      done: false,
      value: new Uint8Array([1, 2, 3]),
    });
    expect(await messageStream.next()).toEqual({
      done: false,
      value: new Uint8Array([4, 5, 6]),
    });
    expect(await messageStream.next()).toEqual({
      done: true,
      value: undefined,
    });
  });

  test('should return an async generator, is devtool', async () => {
    const wxRequest = mockWxRequest({
      responseHeader: {
        'response-header-key': 'response-header-value',
      },
    });
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
      value: new Uint8Array([1, 2, 3, 4, 5, 6]),
    });
    expect(await messageStream.next()).toEqual({
      done: true,
      value: undefined,
    });
  });

  test('should throw if first chunk is not header', async () => {
    const wxRequest = mockWxRequest({
      skipHeadersReceivedHandler: true,
    });
    const request = createWxRequestAsAsyncGenerator({
      request: wxRequest,
      isDevTool: false,
      requestOptions: {
        forceCellularNetwork: true,
      },
    });
    const reqHeaders = new Headers();
    reqHeaders.append('foo', 'bar');
    expect(async () => {
      await request({
        url: 'https://example.com',
        data: 'data',
        method: 'POST',
        header: reqHeaders,
      });
    }).rejects.toThrow('missing header');
  });
});
