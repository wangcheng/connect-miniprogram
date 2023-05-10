import * as React from 'react';
import { createPromiseClient } from '@bufbuild/connect';
import { createConnectTransport, createGrpcWebTransport } from '../../src';
import '../../src/polyfill';
import { ElizaService } from '@buf/bufbuild_eliza.bufbuild_connect-es/buf/connect/demo/eliza/v1/eliza_connect';

const connectTransport = createConnectTransport({
  baseUrl: 'https://demo.connect.build',
  // You need to mannualy pass the request function. You can also pass functions from 3rd party frameworks like `Taro.requst`, as long as they are compatible with Weixin's API
  request: wx.request,
});

// You can also use create a grpc-web transport. The usage is the same.
const grpcWebTransport = createGrpcWebTransport({
  baseUrl: 'https://demo.connect.build',
  request: wx.request,
});

const client = createPromiseClient(ElizaService, grpcWebTransport);

async function unary() {
  const res = await client.say({
    sentence: 'I feel happy.',
  });
  console.log(res);
}

async function serverStream() {
  for await (const res of client.introduce(
    { name: 'Joseph' },
    {
      onHeader: (res) => {
        console.log('onHeader', res);
      },
    },
  )) {
    console.log(res);
  }
}

async function biDirectionalStream() {
  async function* streamReq() {
    yield {
      sentence: 'Hi!',
    };
    yield {
      sentence: 'My name is Emily.',
    };
  }
  for await (const res of client.converse(streamReq())) {
    console.log(res);
  }
}

serverStream();

const App: React.FC = (props) => props.children as React.ReactElement;

export default App;
