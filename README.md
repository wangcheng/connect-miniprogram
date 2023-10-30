# connect-miniprogram

A [Connect](https://connectrpc.com) and gRPC client for Weixin Miniprogram

适配小程序的 [Connect](https://connectrpc.com) 客户端。可以在小程序中使用 Connect 协议和 gRPC 协议的 API。

> Connect is a family of libraries for building browser and gRPC-compatible HTTP APIs: you write a short [Protocol Buffer](https://developers.google.com/protocol-buffers) schema and implement your application logic, and Connect generates code to handle marshaling, routing, compression, and content type negotiation. It also generates an idiomatic, type-safe client in any supported language.

## Polyfill

Connect libraries relys on some APIs that not provided in Weixin environment.

Connect 依赖了一些微信小程序不支持的 API。所以需要引入 Polyfill。

| API                                                                         | Polyfilled by                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers)         | [mswjs/headers-polyfill](https://github.com/mswjs/headers-polyfill)         |
| [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |
| [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |

### Method 1 Use "shimming" (recommended)

Use the bundlers "shimming" feature to replace all usage of `Headers` `TextEncoder` `TextDecoder` with the polyfill version. This is the recommended method because it doesn't pollute the global scope.

使用打包工具的 “Shimming” 功能替换代码中所有的 `Headers` `TextEncoder` `TextDecoder`。比较推荐这种方法，因为这样不会污染 global 对象。

[Webpack](https://webpack.js.org/guides/shimming/#shimming-globals):

```js
module.exports = {
  plugins: [
    new webpack.ProvidePlugin({
      Headers: ['connect-miniprogram/shims.js', 'HeadersPolyfill'],
      TextDecoder: ['connect-miniprogram/shims.js', 'FastTextDecoder'],
      TextEncoder: ['connect-miniprogram/shims.js', 'FastTextEncoder'],
    }),
  ],
};
```

[Taro](https://docs.taro.zone/docs/config-detail/#miniwebpackchain):

```js
{
  webpackChain: (chain, webpack) => {
    chain.plugin('shimming').use(webpack.ProvidePlugin, [
      {
        Headers: ['connect-miniprogram/shims.js', 'HeadersPolyfill'],
        TextDecoder: ['connect-miniprogram/shims.js', 'FastTextDecoder'],
        TextEncoder: ['connect-miniprogram/shims.js', 'FastTextEncoder'],
      },
    ]);
  };
}
```

### Method 1 Use "polyfill"

Import the polyfill at the start of your code:

在小程序代码最开头插入以下内容：

```js
import 'connect-miniprogram/polyfill';
```

## How to use 使用方法

The usage of this library is basically the same with [@connectrpc/connect-web](https://connectrpc.com/docs/web/getting-started/). You can click the link to read its doc. You can also clone the repo and try out the `example-taro` project.

使用方法跟 [@connectrpc/connect-web](https://connectrpc.com/docs/web/getting-started/) 基本相同，你可以点击链接查看文档。你也可以克隆代码，用 `example-taro` 尝试。

```js
import { createPromiseClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcWebTransport,
} from 'connect-miniprogram';
import { ElizaService } from '@buf/bufbuild_eliza.bufbuild_connect-es/buf/connect/demo/eliza/v1/eliza_connect';

const connectTransport = createConnectTransport({
  baseUrl: 'https://demo.connectrpc.com',
  // You need to mannualy pass the request function. You can also pass functions from 3rd party frameworks like `Taro.requst`, as long as they are compatible with Weixin's API
  request: wx.request,
});

// You can also use create a grpc-web transport. The usage is the same.
const grpcWebTransport = createGrpcWebTransport({
  baseUrl: 'https://demo.connectrpc.com',
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
