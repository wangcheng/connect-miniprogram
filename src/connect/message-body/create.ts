import { encodeEnvelope } from '@bufbuild/connect/protocol';
import { MethodKind } from '@bufbuild/protobuf';

export async function createRequestBody<I>(
  input: AsyncIterable<I>,
  serialize: (i: I) => Uint8Array,
  method,
): Promise<Uint8Array> {
  if (method.kind != MethodKind.ServerStreaming) {
    throw 'Weixin does not support streaming request bodies';
  }
  const r = await input[Symbol.asyncIterator]().next();
  if (r.done == true) {
    throw 'missing request message';
  }
  return encodeEnvelope(0, serialize(r.value));
}
