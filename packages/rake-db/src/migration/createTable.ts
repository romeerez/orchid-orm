import {
  ColumnsShape,
  Db,
  EnumColumn,
  getColumnTypes,
  NoPrimaryKeyOption,
  parseTableData,
  escapeString,
  TableData,
  TableDataFn,
  TableDataItem,
  emptyObject,
  MaybeArray,
  QueryArraysResult,
  RecordUnknown,
  snakeCaseKey,
} from 'pqb';
import {
  ColumnComment,
  ColumnsShapeCallback,
  DbMigration,
  Migration,
  TableOptions,
} from './migration';
import {
  addColumnComment,
  addColumnExclude,
  addColumnIndex,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  excludesToQuery,
  getColumnName,
  indexesToQuery,
  interpolateSqlValues,
  primaryKeyToSql,
} from './migration.utils';
import {
  getSchemaAndTableFromName,
  makePopulateEnumQuery,
  quoteWithSchema,
} from '../common';
import { RakeDbAst } from '../ast';
import { tableMethods } from './tableMethods';
import { NoPrimaryKey } from '../errors';

export interface TableQuery {
  text: string;
  values?: unknown[];
  then?(result: QueryArraysResult): void;
}

export interface CreateTableResult<
  Table extends string,
  Shape extends ColumnsShape,
> {
  table: Db<Table, Shape>;
}

export const createTable = async <
  CT,
  Table extends string,
  Shape extends ColumnsShape,
>(
  migration: Migration<CT>,
  up: boolean,
  tableName: Table,
  first?: TableOptions | ColumnsShapeCallback<CT, Shape>,
  second?:
    | ColumnsShapeCallback<CT, Shape>
    | TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>,
  third?: TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>,
): Promise<CreateTableResult<Table, Shape>> => {
  let options: TableOptions;
  let fn: ColumnsShapeCallback<CT, Shape> | undefined;
  let dataFn: TableDataFn<RecordUnknown, MaybeArray<TableDataItem>> | undefined;
  if (typeof first === 'object') {
    options = first;
    fn = second as ColumnsShapeCallback<CT, Shape>;
    dataFn = third as TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>;
  } else {
    options = emptyObject;
    fn = first;
    dataFn = second as TableDataFn<RecordUnknown, MaybeArray<TableDataItem>>;
  }

  const snakeCase =
    'snakeCase' in options ? options.snakeCase : migration.options.snakeCase;
  const language =
    'language' in options ? options.language : migration.options.language;

  const types = Object.assign(
    Object.create(migration.columnTypes as object),
    tableMethods,
  );
  types[snakeCaseKey] = snakeCase;

  let shape: Shape;
  let tableData;
  if (fn) {
    shape = getColumnTypes(
      types,
      fn,
      migration.options.baseTable?.nowSQL,
      language,
    );
    tableData = parseTableData(dataFn);
    tableData.constraints?.forEach((x, i) => {
      if (x.name || !x.check) return;

      x.name = `${tableName}_check${i === 0 ? '' : i}`;
    });
  } else {
    shape = (tableData = emptyObject) as Shape;
  }

  const ast = makeAst(
    up,
    tableName,
    shape,
    tableData,
    options,
    migration.options.noPrimaryKey,
  );

  fn && validatePrimaryKey(ast);

  const queries = astToQueries(ast, snakeCase, language);
  for (const { then, ...query } of queries) {
    const result = await migration.adapter.arrays(interpolateSqlValues(query));
    then?.(result);
  }

  let table: Db<Table, Shape> | undefined;

  return {
    get table(): Db<Table, Shape> {
      return (table ??= (migration as unknown as DbMigration<unknown>)(
        tableName,
        shape,
        undefined,
        {
          noPrimaryKey: options.noPrimaryKey ? 'ignore' : undefined,
          snakeCase,
        },
      ) as unknown as Db<Table, Shape>);
    },
  };
};

const makeAst = (
  up: boolean,
  tableName: string,
  shape: ColumnsShape,
  tableData: TableData,
  options: TableOptions,
  noPrimaryKey?: NoPrimaryKeyOption,
): RakeDbAst.Table => {
  const shapePKeys: string[] = [];
  for (const key in shape) {
    const column = shape[key];
    if (column.data.primaryKey) {
      shapePKeys.push(key);
    }
  }

  const { primaryKey } = tableData;
  const [schema, table] = getSchemaAndTableFromName(tableName);

  return {
    type: 'table',
    action: up ? 'create' : 'drop',
    schema,
    name: table,
    shape,
    ...tableData,
    primaryKey:
      shapePKeys.length <= 1
        ? primaryKey
        : primaryKey
        ? {
            ...primaryKey,
            columns: [...new Set([...shapePKeys, ...primaryKey.columns])],
          }
        : { columns: shapePKeys },
    ...options,
    noPrimaryKey: options.noPrimaryKey ? 'ignore' : noPrimaryKey || 'error',
  };
};

const validatePrimaryKey = (ast: RakeDbAst.Table) => {
  if (ast.noPrimaryKey !== 'ignore') {
    let hasPrimaryKey = !!ast.primaryKey?.columns?.length;
    if (!hasPrimaryKey) {
      for (const key in ast.shape) {
        if (ast.shape[key].data.primaryKey) {
          hasPrimaryKey = true;
          break;
        }
      }
    }

    if (!hasPrimaryKey) {
      const error = new NoPrimaryKey(
        `Table ${ast.name} has no primary key.\nYou can suppress this error by setting { noPrimaryKey: true } after a table name.`,
      );
      if (ast.noPrimaryKey === 'error') {
        throw error;
      } else {
        console.warn(error.message);
      }
    }
  }
};

const astToQueries = (
  ast: RakeDbAst.Table,
  snakeCase?: boolean,
  language?: string,
): TableQuery[] => {
  const queries: TableQuery[] = [];
  const { shape } = ast;

  for (const key in shape) {
    const item = shape[key];
    if (!(item instanceof EnumColumn)) continue;

    queries.push(makePopulateEnumQuery(item));
  }

  if (ast.action === 'drop') {
    queries.push({
      text: `DROP TABLE${
        ast.dropIfExists ? ' IF EXISTS' : ''
      } ${quoteWithSchema(ast)}${ast.dropMode ? ` ${ast.dropMode}` : ''}`,
    });
    return queries;
  }

  const lines: string[] = [];
  const values: unknown[] = [];
  const indexes: TableData.Index[] = [];
  const excludes: TableData.Exclude[] = [];
  const comments: ColumnComment[] = [];

  for (const key in shape) {
    const item = shape[key];
    const name = getColumnName(item, key, snakeCase);
    addColumnIndex(indexes, name, item);
    addColumnExclude(excludes, name, item);
    addColumnComment(comments, name, item);
    lines.push(
      `\n  ${columnToSql(name, item, values, !!ast.primaryKey, snakeCase)}`,
    );
  }

  if (ast.primaryKey) {
    lines.push(
      `\n  ${primaryKeyToSql({
        name: ast.primaryKey.name,
        columns: ast.primaryKey.columns.map((key) =>
          getColumnName(shape[key], key, snakeCase),
        ),
      })}`,
    );
  }

  ast.constraints?.forEach((item) => {
    lines.push(
      `\n  ${constraintToSql(
        ast,
        true,
        {
          ...item,
          references: item.references
            ? {
                ...item.references,
                columns: item.references.columns.map((column) =>
                  getColumnName(shape[column], column, snakeCase),
                ),
              }
            : undefined,
        },
        values,
        snakeCase,
      )}`,
    );
  });

  pushIndexesOrExcludesFromAst(indexes, ast.indexes, shape, snakeCase);
  pushIndexesOrExcludesFromAst(excludes, ast.excludes, shape, snakeCase);

  queries.push(
    {
      text: `CREATE TABLE${
        ast.createIfNotExists ? ' IF NOT EXISTS' : ''
      } ${quoteWithSchema(ast)} (${lines.join(',')}\n)`,
      values,
    },
    ...indexesToQuery(true, ast, indexes, snakeCase, language),
    ...excludesToQuery(true, ast, excludes, snakeCase),
    ...commentsToQuery(ast, comments),
  );

  if (ast.comment) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${escapeString(
        ast.comment,
      )}`,
    });
  }

  return queries;
};

const pushIndexesOrExcludesFromAst = <
  T extends TableData.Index | TableData.Exclude,
>(
  arr: T[],
  inAst: T[] | undefined,
  shape: ColumnsShape,
  snakeCase?: boolean,
) => {
  arr.push(
    ...(inAst?.map((x) => ({
      ...x,
      columns: x.columns.map((item) => ({
        ...item,
        ...('column' in item
          ? {
              column: getColumnName(shape[item.column], item.column, snakeCase),
            }
          : {}),
      })),
    })) || []),
  );
};
