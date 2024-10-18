import { createClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram/src';
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

export async function main() {
  connectClient
    .say({
      sentence: 'I feel happy.',
    })
    .then((res) => {
      console.log('[connect.say]', res);
    });

  for await (const res of connectClient.introduce({ name: 'Joseph' })) {
    console.log('[connect.introduce]', res);
  }

  grpcClient
    .say({
      sentence: 'I feel happy.',
    })
    .then((res) => {
      console.log('[grpc.say]', res);
    });

  for await (const res of grpcClient.introduce({ name: 'Joseph' })) {
    console.log('[grpc.introduce]', res);
  }
}
