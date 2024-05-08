// This is a standard Promise['then'] method
// copied from TS standard library because the original `then` is not decoupled from the Promise
export type QueryThen<T> = <TResult1 = T, TResult2 = never>(
  onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
) => Promise<TResult1 | TResult2>;

// This is a standard Promise['catch'] method
// copied from TS standard library because the original `catch` is not decoupled from the Promise
export type QueryCatch = <Q, TResult = never>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this: { then: (onfulfilled?: (value: Q) => any) => any },
  onrejected?: (reason: any) => TResult | PromiseLike<TResult>,
) => Promise<Q | TResult>;
