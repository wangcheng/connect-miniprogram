import { View, Text } from '@tarojs/components';
import { useLoad, request, getSystemInfoSync } from '@tarojs/taro';
import { createPromiseClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram';
import { ElizaService } from '@buf/connectrpc_eliza.connectrpc_es/connectrpc/eliza/v1/eliza_connect';

const isDevTool = getSystemInfoSync().platform === 'devtools';
const baseUrl = 'https://demo.connectrpc.com';

const connectTransport = createConnectTransport({
  baseUrl,
  request,
  isDevTool,
});

const connectClient = createPromiseClient(ElizaService, connectTransport);

const grpcTransport = createGrpcWebTransport({
  baseUrl,
  request,
  isDevTool,
});

const grpcClient = createPromiseClient(ElizaService, grpcTransport);

export default function Index() {
  useLoad(async () => {
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
  });

  return (
    <View>
      <Text>Hello world!</Text>
    </View>
  );
}
