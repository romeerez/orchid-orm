import {
  AdapterTransactionOptions,
  TransactionAdapterBase,
  TransactionArgs,
} from './adapter';

interface SolvedTransactionArgs {
  options: AdapterTransactionOptions | undefined;
  cb: (adapter: TransactionAdapterBase) => Promise<unknown>;
}

const transactionArgs: SolvedTransactionArgs = {
  cb: undefined,
  options: undefined,
} as never;

export const getTransactionArgs = (args: TransactionArgs<unknown>) => {
  if (args[1]) {
    transactionArgs.options = args[0] as AdapterTransactionOptions;
    transactionArgs.cb = args[1];
  } else {
    transactionArgs.cb = args[0] as never;
  }
  return transactionArgs;
};

export const getSetLocalsSql = (
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.locals) return;

  return Object.entries(options?.locals)
    .map(([key, value]) => `SET LOCAL ${key}=${value}`)
    .join('; ');
};
