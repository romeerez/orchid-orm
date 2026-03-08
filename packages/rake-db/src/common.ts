import {
  AdapterBase,
  ColumnSchemaConfig,
  EnumColumn,
  QuerySchema,
  singleQuote,
} from 'pqb';
import { TableQuery } from './migration/create-table';
import { MigrationsSet } from './migration/migrations-set';
import { RakeDbConfig } from './config';

export const RAKE_DB_LOCK_KEY = '8582141715823621641';

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
  schema: QuerySchema | undefined,
  name: string,
): [string | undefined, string] => {
  const i = name.indexOf('.');
  return i !== -1
    ? [name.slice(0, i), name.slice(i + 1)]
    : [typeof schema === 'function' ? schema() : schema, name];
};

export const quoteNameFromString = (
  schema: QuerySchema | undefined,
  string: string,
) => {
  return quoteTable(...getSchemaAndTableFromName(schema, string));
};

/**
 * Do not quote the type itself because it can be an expression like `geography(point)` for postgis.
 */
export const quoteCustomType = (
  schema: QuerySchema | undefined,
  type: string,
) => {
  const [s, t] = getSchemaAndTableFromName(schema, type);
  return s ? '"' + s + '".' + t : t;
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
  schema: QuerySchema | undefined,
  item: EnumColumn<ColumnSchemaConfig, unknown, readonly string[]>,
): TableQuery => {
  const [s, name] = getSchemaAndTableFromName(schema, item.enumName);
  return {
    text: `SELECT unnest(enum_range(NULL::${quoteTable(s, name)}))::text`,
    then(result) {
      // populate empty options array with values from db
      (item.options as string[]).push(...result.rows.map(([value]) => value));
    },
  };
};

export const transaction = <T>(
  adapter: AdapterBase,
  config: Pick<RakeDbConfig, 'transactionSearchPath'>,
  fn: (trx: AdapterBase) => Promise<T>,
): Promise<T> => {
  const searchPath = config.transactionSearchPath;
  return adapter.transaction<T>(
    searchPath
      ? {
          locals: {
            search_path:
              typeof searchPath === 'function' ? searchPath() : searchPath,
          },
        }
      : undefined,
    fn,
  );
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
