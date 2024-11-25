type InputFn<T> = (handlers: {
  handleValue: (v: T) => void;
  handleEnd: () => void;
  handleError: (e: any) => void;
}) => () => void;

export function createAsyncGeneratorFromEventPattern<T>(fn: InputFn<T>) {
  return async function* stream() {
    let results: T[] = [];
    let resolve: (value?: any) => void;
    let promise = new Promise((r) => (resolve = r));
    let done = false;

    const next = () => {
      resolve();
      promise = new Promise((r) => (resolve = r));
    };

    const handleValue = (value: T) => {
      results.push(value);
      next();
    };

    const handleEnd = () => {
      done = true;
      resolve();
    };

    const handleError = (e) => {
      done = true;
      resolve();
      throw e;
    };

    const dispose = fn({ handleValue, handleEnd, handleError });

    while (!done) {
      await promise;
      yield* results;
      results = [];
    }
    dispose();
  };
}
