import { Adapter, EnumColumn, TransactionAdapter } from 'pqb';
import { ColumnSchemaConfig, singleQuote } from 'orchid-core';
import { TableQuery } from './migration/createTable';
import { RAKE_DB_LOCK_KEY } from './commands/migrateOrRollback';
import { MigrationsSet } from './migration/migrationsSet';

export interface RakeDbCtx {
  migrationsPromise?: Promise<MigrationsSet>;
}

export const getFirstWordAndRest = (
  input: string,
): [string] | [string, string] => {
  const index = input.search(/(?=[A-Z])|[-_]/);
  if (index !== -1) {
    const restStart =
      input[index] === '-' || input[index] === '_' ? index + 1 : index;
    const rest = input.slice(restStart);
    return [input.slice(0, index), rest[0].toLowerCase() + rest.slice(1)];
  } else {
    return [input];
  }
};

const getTextAfterRegExp = (
  input: string,
  regex: RegExp,
  length: number,
): string | undefined => {
  let index = input.search(regex);
  if (index === -1) return;

  if (input[index] === '-' || input[index] === '_') index++;
  index += length;

  const start = input[index] == '-' || input[index] === '_' ? index + 1 : index;
  const text = input.slice(start);
  return text[0].toLowerCase() + text.slice(1);
};

export const getTextAfterTo = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(To|-to|_to)[A-Z-_]/, 2);
};

export const getTextAfterFrom = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(From|-from|_from)[A-Z-_]/, 4);
};

// Join array of strings into a camelCased string.
export const joinWords = (...words: string[]) => {
  return words
    .slice(1)
    .reduce(
      (acc, word) => acc + word[0].toUpperCase() + word.slice(1),
      words[0],
    );
};

export const joinColumns = (columns: string[]) => {
  return columns.map((column) => `"${column}"`).join(', ');
};

export const quoteWithSchema = ({
  schema,
  name,
}: {
  schema?: string;
  name: string;
}) => quoteTable(schema, name);

export const quoteTable = (schema: string | undefined, table: string) =>
  schema ? `"${schema}"."${table}"` : `"${table}"`;

export const getSchemaAndTableFromName = (
  name: string,
): [string | undefined, string] => {
  const index = name.indexOf('.');
  return index !== -1
    ? [name.slice(0, index), name.slice(index + 1)]
    : [undefined, name];
};

export const quoteNameFromString = (string: string) => {
  return quoteTable(...getSchemaAndTableFromName(string));
};

/**
 * Do not quote the type itself because it can be an expression like `geography(point)` for postgis.
 */
export const quoteCustomType = (s: string) => {
  const [schema, type] = getSchemaAndTableFromName(s);
  return schema ? '"' + schema + '".' + type : type;
};

export const quoteSchemaTable = (arg: { schema?: string; name: string }) => {
  return singleQuote(concatSchemaAndName(arg));
};

export const concatSchemaAndName = ({
  schema,
  name,
}: {
  schema?: string;
  name: string;
}) => {
  return schema ? `${schema}.${name}` : name;
};

export const makePopulateEnumQuery = (
  item: EnumColumn<ColumnSchemaConfig, unknown>,
): TableQuery => {
  const [schema, name] = getSchemaAndTableFromName(item.enumName);
  return {
    text: `SELECT unnest(enum_range(NULL::${quoteTable(schema, name)}))::text`,
    then(result) {
      // populate empty options array with values from db
      item.options.push(...result.rows.map(([value]) => value));
    },
  };
};

// SQL to start a transaction
const begin = {
  text: 'BEGIN',
};

export const transaction = <T>(
  adapter: Adapter,
  fn: (trx: TransactionAdapter) => Promise<T>,
): Promise<T> => {
  return adapter.transaction(begin, fn);
};

export const queryLock = (trx: TransactionAdapter) =>
  trx.query(`SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const exhaustive = (_: never) => {
  throw new Error('Condition was not exhaustive');
};

export const pluralize = (w: string, count: number, append = 's') => {
  return count === 1 ? w : w + append;
};
