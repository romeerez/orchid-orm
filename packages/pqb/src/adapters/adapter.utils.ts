import {
  AdapterTransactionOptions,
  TransactionAdapterBase,
  TransactionArgs,
} from './adapter';
import { RecordStringOrNumber } from 'pqb/internal';

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

export const mergeLocals = (
  locals: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): RecordStringOrNumber =>
  options?.locals ? { ...locals, ...options.locals } : locals;

export const getSetLocalsSql = (
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.locals) return;

  return Object.entries(options.locals)
    .map(([key, value]) => `SET LOCAL ${key}=${value}`)
    .join('; ');
};

export const getResetLocalsSql = (
  parentLocals: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.locals) return;

  return Object.entries(options.locals)
    .reduce<string[]>((acc, [key, value]) => {
      if (parentLocals[key] !== value) {
        acc.push(`SET LOCAL ${key}=${parentLocals[key]}`);
      }
      return acc;
    }, [])
    .join('; ');
};
