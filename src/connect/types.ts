import type {
  BinaryReadOptions,
  BinaryWriteOptions,
  JsonReadOptions,
  JsonWriteOptions,
} from '@bufbuild/protobuf';

export interface AdditionalRequestOptions {
  enableHttp2?: boolean;
  enableQuic?: boolean;
  enableCache?: boolean;
  enableHttpDNS?: boolean;
  httpDNSServiceId?: string;
  forceCellularNetwork?: boolean;
}

export interface CreateTransportOptions {
  /**
   * The request API function.
   * You can also pass functions from 3rd party frameworks like Taro
   * as long as they are compatible with Weixin's API
   */
  request: typeof wx.request;

  /**
   * Weixin devtool has a bug if enableChunked is true.
   * https://developers.weixin.qq.com/community/develop/doc/000e44fc464560a0a6bf4188f56800
   */
  isDevTool?: boolean;

  /**
   * Base URI for all HTTP requests.
   *
   * Requests will be made to <baseUrl>/<package>.<service>/method
   *
   * Example: `baseUrl: "https://example.com/my-api"`
   *
   * This will make a `POST /my-api/my_package.MyService/Foo` to
   * `example.com` via HTTPS.
   */
  baseUrl: string;

  /**
   * By default, clients use the binary format for gRPC-web, because
   * not all gRPC-web implementations support JSON.
   */
  useBinaryFormat?: boolean;

  /**
   * Options for the JSON format.
   */
  jsonOptions?: Partial<JsonReadOptions & JsonWriteOptions>;

  /**
   * Options for the binary wire format.
   */
  binaryOptions?: Partial<BinaryReadOptions & BinaryWriteOptions>;

  /**
   * Additional options for wx.request
   */
  requestOptions?: AdditionalRequestOptions;
}
