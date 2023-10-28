import { View, Text } from '@tarojs/components';
import { useLoad, request } from '@tarojs/taro';
import { createPromiseClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram';
import { ElizaService } from '../../../pb/eliza_connect';

export default function Index() {
  useLoad(async () => {
    const connectTransport = createConnectTransport({
      baseUrl: 'https://demo.connectrpc.com',
      // You need to mannualy pass the request function. You can also pass functions from 3rd party frameworks like `Taro.requst`, as long as they are compatible with Weixin's API
      request: request,
    });

    const client = createPromiseClient(ElizaService, connectTransport);

    client
      .say({
        sentence: 'I feel happy.',
      })
      .then((res) => {
        console.log('[say]', res);
      });

    for await (const res of client.introduce({ name: 'Joseph' })) {
      console.log('[introduce]', res);
    }
  });

  return (
    <View>
      <Text>Hello world!</Text>
    </View>
  );
}
