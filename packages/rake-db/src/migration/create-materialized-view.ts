import { Migration } from './migration';
import { raw, RawSqlBase, QuerySchema, SingleSql } from 'pqb/internal';
import { RakeDbAst } from '../ast';
import { getSchemaAndTableFromName } from '../common';
import { interpolateSqlValues } from './migration.utils';

export const createMaterializedView = async (
  migration: Migration,
  up: boolean,
  name: string,
  options: RakeDbAst.MaterializedViewOptions,
  sql: string | RawSqlBase,
): Promise<void> => {
  const schema = migration.adapter.getSchema();
  const ast = makeAst(schema, up, name, options, sql);
  const query = astToQuery(ast);

  await migration.adapter.arrays(interpolateSqlValues(query));
};

export const refreshMaterializedView = async (
  migration: Migration,
  name: string,
  options: RakeDbAst.RefreshMaterializedViewOptions = {},
): Promise<void> => {
  if (options.concurrently && options.withData === false) {
    throw new Error(
      'Cannot refresh a materialized view concurrently with WITH NO DATA',
    );
  }

  const schema = migration.adapter.getSchema();
  const [s, viewName] = getSchemaAndTableFromName(schema, name);
  const sql: string[] = ['REFRESH MATERIALIZED VIEW'];

  if (options.concurrently) sql.push('CONCURRENTLY');

  sql.push(`${s ? `"${s}".` : ''}"${viewName}"`);
  pushWithData(sql, options);

  await migration.adapter.arrays(sql.join(' '));
};

const makeAst = (
  schema: QuerySchema | undefined,
  up: boolean,
  fullName: string,
  options: RakeDbAst.MaterializedViewOptions,
  sql: string | RawSqlBase,
): RakeDbAst.MaterializedView => {
  if (typeof sql === 'string') {
    sql = raw({ raw: sql });
  }

  const [s, name] = getSchemaAndTableFromName(schema, fullName);

  return {
    type: 'materializedView',
    action: up ? 'create' : 'drop',
    schema: s,
    name,
    shape: {},
    sql,
    options,
    deps: [],
  };
};

const astToQuery = (ast: RakeDbAst.MaterializedView): SingleSql => {
  const values: unknown[] = [];
  const sql: string[] = [];
  const { options } = ast;
  const sqlName = `${ast.schema ? `"${ast.schema}".` : ''}"${ast.name}"`;

  if (ast.action === 'create') {
    sql.push(`CREATE MATERIALIZED VIEW ${sqlName}`);

    if (options?.columns) {
      sql.push(
        `(${options.columns.map((column) => `"${column}"`).join(', ')})`,
      );
    }

    sql.push(`AS (${ast.sql.toSQL({ values })})`);
    pushWithData(sql, options);
  } else {
    sql.push('DROP MATERIALIZED VIEW');

    if (options?.dropIfExists) sql.push(`IF EXISTS`);

    sql.push(sqlName);

    if (options?.dropMode) sql.push(options.dropMode);
  }

  return {
    text: sql.join(' '),
    values,
  };
};

const pushWithData = (
  sql: string[],
  options:
    | RakeDbAst.MaterializedViewOptions
    | RakeDbAst.RefreshMaterializedViewOptions,
) => {
  if (options.withData === true) {
    sql.push('WITH DATA');
  } else if (options.withData === false) {
    sql.push('WITH NO DATA');
  }
};
