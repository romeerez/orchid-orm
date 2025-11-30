import { EnumColumn, AdapterBase, ColumnSchemaConfig, singleQuote } from 'pqb';
import { TableQuery } from './migration/createTable';
import { RAKE_DB_LOCK_KEY } from './commands/migrateOrRollback';
import { MigrationsSet } from './migration/migrationsSet';

export interface RakeDbCtx {
  migrationsPromise?: Promise<MigrationsSet>;
}

export const getFirstWordAndRest = (
  input: string,
): [string] | [string, string] => {
  const i = input.search(/(?=[A-Z])|[-_ ]/);
  if (i !== -1) {
    const restStart =
      input[i] === '-' || input[i] === '_' || input[i] === ' ' ? i + 1 : i;
    const rest = input.slice(restStart);
    return [input.slice(0, i), rest[0].toLowerCase() + rest.slice(1)];
  } else {
    return [input];
  }
};

const getTextAfterRegExp = (
  input: string,
  regex: RegExp,
  length: number,
): string | undefined => {
  let i = input.search(regex);
  if (i === -1) return;

  if (input[i] === '-' || input[i] === '_' || input[i] === ' ') i++;
  i += length;

  const start =
    input[i] == '-' || input[i] === '_' || input[i] === ' ' ? i + 1 : i;
  const text = input.slice(start);
  return text[0].toLowerCase() + text.slice(1);
};

export const getTextAfterTo = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(To|-to|_to| to)[A-Z-_ ]/, 2);
};

export const getTextAfterFrom = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(From|-from|_from| from)[A-Z-_ ]/, 4);
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
  const i = name.indexOf('.');
  return i !== -1 ? [name.slice(0, i), name.slice(i + 1)] : [undefined, name];
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

export const quoteSchemaTable = (
  arg: { schema?: string; name: string },
  excludeCurrentSchema?: string,
) => {
  return singleQuote(concatSchemaAndName(arg, excludeCurrentSchema));
};

export const concatSchemaAndName = (
  {
    schema,
    name,
  }: {
    schema?: string;
    name: string;
  },
  excludeCurrentSchema?: string,
) => {
  return schema && schema !== excludeCurrentSchema ? `${schema}.${name}` : name;
};

export const makePopulateEnumQuery = (
  item: EnumColumn<ColumnSchemaConfig, unknown, readonly string[]>,
): TableQuery => {
  const [schema, name] = getSchemaAndTableFromName(item.enumName);
  return {
    text: `SELECT unnest(enum_range(NULL::${quoteTable(schema, name)}))::text`,
    then(result) {
      // populate empty options array with values from db
      (item.options as string[]).push(...result.rows.map(([value]) => value));
    },
  };
};

export const transaction = <T>(
  adapter: AdapterBase,
  fn: (trx: AdapterBase) => Promise<T>,
): Promise<T> => {
  return adapter.transaction<T>(undefined, fn);
};

export const queryLock = (trx: AdapterBase) =>
  trx.query(`SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`);

export const getCliParam = (
  args: string[] | undefined,
  name: string,
): string | undefined => {
  if (args) {
    const key = '--' + name;
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === key) return args[i + 1];
      else if (arg.startsWith(key)) return arg.slice(key.length + 1);
    }
  }
  return;
};
