# connect-miniprogram

A [Connect](https://connect.build/docs/introduction/) client for Wexin Miniprogram

适配小程序的 [Connect](https://connect.build/docs/introduction/) 客户端。可以在小程序中使用访问 Connect 生成的服务。支持 GRPC 和流式请求。

## Headers API polyfill

Connect rely on [Headers API](https://developer.mozilla.org/en-US/docs/Web/API/Headers) which is not supported in Weixin.This project comes with a polyfill using [mswjs/headers-polyfill](https://github.com/mswjs/headers-polyfill). Remember to import the file in the entry of your project.

```js
import 'connect-miniprogram/polyfill';
```

## How to use

The usage of this library is basically the same with [@bufbuild/connect-web](https://connect.build/docs/web/getting-started). You can click the link to read its doc.

```js
import { createPromiseClient } from '@bufbuild/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram';
import { ElizaService } from '@buf/bufbuild_eliza.bufbuild_connect-es/buf/connect/demo/eliza/v1/eliza_connect';

const connectTransport = createConnectTransport({
  baseUrl: 'https://demo.connect.build',
  // You need to mannualy pass the request function. You can also pass functions from 3rd party frameworks like `Taro.requst`, as long as they are compatible with Weixin's API
  request: wx.request,
});

// You can also use create a grpc-web transport. The usage is the same.
const createGrpcWebTransport = createGrpcWebTransport({
  baseUrl: 'https://demo.connect.build',
  request: wx.request,
});

const client = createPromiseClient(ElizaService, connectTransport);

async function unary() {
  const res = await client.say({
    sentence: 'I feel happy.',
  });
  console.log(res);
}

async function serverStream() {
  for await (const res of client.introduce({ name: 'Joseph' })) {
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
```

## Differences with @bufbuild/connect-web

- Doesn't support interceptor
- Doesn't support AbortSignal
