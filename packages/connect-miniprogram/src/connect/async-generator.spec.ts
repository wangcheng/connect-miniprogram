import { describe, expect, jest, test } from '@jest/globals';

import { fireEventQueue } from '../test-utils';
import { createAsyncGeneratorFromEventPattern } from './async-generator';

describe('createAsyncGeneratorFromEventPattern', () => {
  const dispose = jest.fn();
  test('creates am async generator', async () => {
    const gen = createAsyncGeneratorFromEventPattern<number>(
      ({ handleValue, handleEnd }) => {
        fireEventQueue([
          () => {
            handleValue(0);
          },
          () => {
            handleValue(1);
          },
          () => {
            handleValue(2);
          },
          () => {
            handleEnd();
          },
        ]);
        return dispose;
      },
    );
    const a = gen();
    expect(dispose).toBeCalledTimes(0);
    expect(await a.next()).toEqual({ value: 0, done: false });
    expect(dispose).toBeCalledTimes(0);
    expect(await a.next()).toEqual({ value: 1, done: false });
    expect(dispose).toBeCalledTimes(0);
    expect(await a.next()).toEqual({ value: 2, done: false });
    expect(dispose).toBeCalledTimes(0);
    expect(await a.next()).toEqual({ value: undefined, done: true });
    expect(dispose).toBeCalledTimes(1);
  });
});
