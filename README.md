# connect-miniprogram

A [Connect](https://github.com/connectrpc/connect-es/tree/main/packages/connect-web) client library Weixin Miniprogram. Both [Connect RPC](https://connectrpc.com/docs/protocol) and [gRPC-web](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md) protocols are supported.

适配小程序的 [Connect](https://connectrpc.com) 客户端。可以在小程序中使用 [Connect RPC 协议](https://connectrpc.com/docs/protocol) 和 [gRPC-web 协议](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md) 的 API。

> Connect is a family of libraries for building browser and gRPC-compatible HTTP APIs: you write a short [Protocol Buffer](https://developers.google.com/protocol-buffers) schema and implement your application logic, and Connect generates code to handle marshaling, routing, compression, and content type negotiation. It also generates an idiomatic, type-safe client in any supported language.

## Polyfill

Connect libraries relys on some APIs that not provided in Weixin environment.

Connect 依赖了一些微信小程序不支持的 API。所以需要引入 Polyfill。

| API                                                                         | Polyfilled by                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers)         | [mswjs/headers-polyfill](https://github.com/mswjs/headers-polyfill)         |
| [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |
| [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) | [samthor/fast-text-encoding](https://github.com/samthor/fast-text-encoding) |

Import the polyfill at the start of your code:

在小程序代码最开头插入以下内容：

```js
import 'connect-miniprogram/polyfill';
```

## How to use 使用方法

This library is a port of the official [@connectrpc/connect-web](https://github.com/connectrpc/connect-es/tree/main/packages/connect-web) library. The usage is very similar to it. You can click [this link](https://connectrpc.com/docs/web/getting-started/) to read its doc. You can also clone the repo and try out the `example-taro` project.

使用方法跟 [@connectrpc/connect-web](https://connectrpc.com/docs/web/getting-started/) 基本相同，你可以点击链接查看文档。你也可以克隆代码，用 `example-taro` 尝试。

What this library do it we port `createConnectTransport` and `createGrpcWebTransport` to work in Miniprograms. You only need to import one of These 2 functions to create a `transport` object, then use the offical package `@connectrpc/connect` to create the client.

本库做的事情只是移植了 `createConnectTransport` 和 `createGrpcWebTransport` 两个函数，使他们能在微信小程序中工作。你需要引入他们来创建一个 `transport` 对象，然后用官方包 `@connectrpc/connect` 来创建 `client` 对象

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

## Limitations 局限性

- Doesn't support `signal` option because Weixin doesn't have `AbortSignal` API.
- Doesn't support `interceptor` and `contextValues` option. I don't have a plan to implement them because they heavily depend on `AbortSignal` API
- Doesn't support stream request body because either `fetch` or Weixin dosen't support sending stream request.

- 不支持 `signal` 选项，因为微信不支持 `AbortSignal` API。
- 不支持 `interceptor` 和 `contextValues` 选项。我也不打算实现，因为它们依赖 `AbortSignal` API。
- 不支持客户端流式请求。因为微信和浏览器都不支持发送流失请求。
