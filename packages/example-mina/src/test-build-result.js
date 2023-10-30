import 'connect-miniprogram/polyfill';

import { createPromiseClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram';
import { ElizaService } from '@buf/connectrpc_eliza.connectrpc_es/connectrpc/eliza/v1/eliza_connect';

export const isDevTool = wx.getSystemInfoSync().platform === 'devtools';

export const baseUrl = 'https://demo.connectrpc.com';

const grpcTransport = createGrpcWebTransport({
  baseUrl,
  request: wx.request,
  isDevTool,
});

const grpcClient = createPromiseClient(ElizaService, grpcTransport);

const connectTransport = createConnectTransport({
  baseUrl,
  request: wx.request,
  isDevTool,
});

const connectClient = createPromiseClient(ElizaService, connectTransport);
