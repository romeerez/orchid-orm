import { AdapterTransactionOptions } from './adapter';
import { RecordStringOrNumber } from '../utils';

export const mergeSetConfig = (
  setConfig: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): RecordStringOrNumber =>
  options?.setConfig ? { ...setConfig, ...options.setConfig } : setConfig;

export const getSetConfigSql = (
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.setConfig) return;

  return Object.entries(options.setConfig)
    .map(([key, value]) => `SET LOCAL ${key}=${value}`)
    .join('; ');
};

export const getResetSetConfigSql = (
  parentSetConfig: RecordStringOrNumber,
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.setConfig) return;

  return Object.entries(options.setConfig)
    .reduce<string[]>((acc, [key, value]) => {
      if (parentSetConfig[key] === value) return acc;

      if (Object.prototype.hasOwnProperty.call(parentSetConfig, key)) {
        acc.push(`SET LOCAL ${key}=${parentSetConfig[key]}`);
      } else {
        acc.push(`RESET ${key}`);
      }

      return acc;
    }, [])
    .join('; ');
};
