import { AdapterTransactionOptions, SqlSessionState } from './adapter';
import { quoteIdentifier } from '../utils';

export const getSetRoleSql = (
  parentRole?: string,
  options?: AdapterTransactionOptions,
) => {
  if (!options?.role) return;

  return parentRole !== options.role
    ? `SET LOCAL ROLE ${quoteIdentifier(options.role)}`
    : undefined;
};

export const getResetRoleSql = (
  parentRole?: string,
  options?: AdapterTransactionOptions,
) => {
  if (!options?.role) return;

  return parentRole !== options.role
    ? parentRole
      ? `SET LOCAL ROLE ${quoteIdentifier(parentRole)}`
      : `RESET ROLE`
    : undefined;
};

export const getSetConfigSql = (
  parentSetConfig?: SqlSessionState['setConfig'],
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.setConfig) return;

  const expressions = Object.entries(options.setConfig).reduce<string[]>(
    (acc, [key, value]) => {
      if (!parentSetConfig || parentSetConfig[key] !== value) {
        acc.push(setConfigSql(key, value));
      }

      return acc;
    },
    [],
  );

  return expressions.length ? `SELECT ${expressions.join(', ')}` : undefined;
};

export const getResetSetConfigSql = (
  parentSetConfig?: SqlSessionState['setConfig'],
  options?: AdapterTransactionOptions,
): string | undefined => {
  if (!options?.setConfig) return;

  const expressions = Object.entries(options.setConfig).reduce<string[]>(
    (acc, [key, value]) => {
      if (parentSetConfig && key in parentSetConfig) {
        if (parentSetConfig[key] !== value) {
          acc.push(setConfigSql(key, parentSetConfig[key]));
        }
      } else {
        acc.push(setConfigSql(key, undefined));
      }

      return acc;
    },
    [],
  );

  return expressions.length ? `SELECT ${expressions.join(', ')}` : undefined;
};

const setConfigSql = (
  key: string,
  value: string | number | boolean | undefined,
) => {
  return `set_config('${key.replace(/'/g, "''")}', '${typeof value === 'string' ? value.replace(/'/g, "''") : value === undefined ? '' : value}', true)`;
};
