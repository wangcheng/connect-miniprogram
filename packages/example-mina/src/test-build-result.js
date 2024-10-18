import 'connect-miniprogram/polyfill';

import { createClient } from '@connectrpc/connect';
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

const grpcClient = createClient(ElizaService, grpcTransport);

const connectTransport = createConnectTransport({
  baseUrl,
  request: wx.request,
  isDevTool,
});

const connectClient = createClient(ElizaService, connectTransport);
