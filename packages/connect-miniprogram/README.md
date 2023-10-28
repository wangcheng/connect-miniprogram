# connect-miniprogram

A [Connect](https://connect.build/docs/introduction/) client for Weixin Miniprogram

适配小程序的 [Connect](https://connect.build/docs/introduction/) 客户端。可以在小程序中使用访问 Connect 生成的服务。支持 GRPC 和流式请求。

## Polyfill

Connect libraries relys on some APIs that not provided in Weixin environment.

| API                                                                         | Polyfilled by                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers)         | [mswjs/headers-polyfill](https://github.com/mswjs/headers-polyfill)         |
| [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |
| [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |

Import the polyfill at the start of your code:

```js
import 'connect-miniprogram/polyfill';
```

## How to use

The usage of this library is basically the same with [@connectrpc/connect-web](https://connect.build/docs/web/getting-started). You can click the link to read its doc.

```js
import { createPromiseClient } from '@connectrpc/connect';
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
const grpcWebTransport = createGrpcWebTransport({
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
```

## Limitations

- Doesn't support interceptor and `contextValues` option.
- Doesn't support `signal` option because Weixin doesn't have `AbortSignal` API.
- Doesn't support stream request body because either `fetch` or Weixin dosen't support sending stream request.
