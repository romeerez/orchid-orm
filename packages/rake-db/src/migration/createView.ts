import { Migration } from './migration';
import { singleQuote, raw, SingleSql, RawSqlBase } from 'pqb';
import { RakeDbAst } from '../ast';
import { interpolateSqlValues } from './migration.utils';

export const createView = async <CT>(
  migration: Migration<CT>,
  up: boolean,
  name: string,
  options: RakeDbAst.ViewOptions,
  sql: string | RawSqlBase,
): Promise<void> => {
  const ast = makeAst(up, name, options, sql);
  const query = astToQuery(ast);

  await migration.adapter.arrays(interpolateSqlValues(query));
};

const makeAst = (
  up: boolean,
  name: string,
  options: RakeDbAst.ViewOptions,
  sql: string | RawSqlBase,
): RakeDbAst.View => {
  if (typeof sql === 'string') {
    sql = raw({ raw: sql });
  }

  return {
    type: 'view',
    action: up ? 'create' : 'drop',
    name,
    shape: {},
    sql,
    options,
    deps: [],
  };
};

const astToQuery = (ast: RakeDbAst.View): SingleSql => {
  const values: unknown[] = [];
  const sql: string[] = [];
  const { options } = ast;

  if (ast.action === 'create') {
    sql.push('CREATE');

    if (options?.createOrReplace) sql.push('OR REPLACE');
    if (options?.temporary) sql.push('TEMPORARY');
    if (options?.recursive) sql.push('RECURSIVE');

    sql.push(`VIEW "${ast.name}"`);

    if (options?.columns) {
      sql.push(
        `(${options.columns.map((column) => `"${column}"`).join(', ')})`,
      );
    }

    if (options?.with) {
      const list: string[] = [];
      if (options.with.checkOption)
        list.push(`check_option = ${singleQuote(options.with.checkOption)}`);
      if (options.with.securityBarrier) list.push(`security_barrier = true`);
      if (options.with.securityInvoker) list.push(`security_invoker = true`);
      sql.push(`WITH ( ${list.join(', ')} )`);
    }

    sql.push(`AS (${ast.sql.toSQL({ values })})`);
  } else {
    sql.push('DROP VIEW');

    if (options?.dropIfExists) sql.push(`IF EXISTS`);

    sql.push(`"${ast.name}"`);

    if (options?.dropMode) sql.push(options.dropMode);
  }

  return {
    text: sql.join(' '),
    values,
  };
};
