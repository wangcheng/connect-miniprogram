import { View, Text } from '@tarojs/components';
import { useLoad, request, getSystemInfoSync } from '@tarojs/taro';
import { createPromiseClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram/src';
import { ElizaService } from '../../../pb/eliza_connect';

const isDevTool = getSystemInfoSync().platform === 'devtools';

export default function Index() {
  useLoad(async () => {
    const connectTransport = createConnectTransport({
      baseUrl: 'https://demo.connectrpc.com',
      request: request,
      isDevTool,
    });

    const connectClient = createPromiseClient(ElizaService, connectTransport);

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

    const grpcTransport = createGrpcWebTransport({
      baseUrl: 'https://demo.connectrpc.com',
      request: request,
      isDevTool,
    });

    const grpcClient = createPromiseClient(ElizaService, grpcTransport);

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
  });

  return (
    <View>
      <Text>Hello world!</Text>
    </View>
  );
}
