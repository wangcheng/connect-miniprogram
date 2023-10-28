import type { ContextValues } from '@connectrpc/connect';

export function warnUnsupportedOptions(
  signal?: AbortSignal,
  contextValues?: ContextValues,
) {
  if (signal) {
    console.warn("connect-miniprogram doesn't support `signal` option");
  }

  if (contextValues) {
    console.warn("connect-miniprogram doesn't support `contextValues` option");
  }
}
