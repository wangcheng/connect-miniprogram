import { request, getSystemInfoSync } from '@tarojs/taro';
import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from 'connect-miniprogram/src';
import { ElizaService } from '@buf/connectrpc_eliza.bufbuild_es/connectrpc/eliza/v1/eliza_pb';
import TestPage from '../../TestPage';

const isDevTool = getSystemInfoSync().platform === 'devtools';
const baseUrl = 'https://demo.connectrpc.com';

const grpcTransport = createConnectTransport({
  baseUrl,
  request,
  isDevTool,
});

const grpcClient = createClient(ElizaService, grpcTransport);

export default function Index() {
  return <TestPage client={grpcClient} />;
}
