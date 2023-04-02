import { MigrationBase } from './migration';
import { raw, RawExpression, singleQuote } from 'orchid-core';
import { RakeDbAst } from '../ast';
import { getRaw, Sql } from 'pqb';

export const createView = async (
  migration: MigrationBase,
  up: boolean,
  name: string,
  options: RakeDbAst.ViewOptions,
  sql: string | RawExpression,
): Promise<void> => {
  const ast = makeAst(up, name, options, sql);
  const query = astToQuery(ast);

  await migration.adapter.query(query);

  migration.migratedAsts.push(ast);
};

const makeAst = (
  up: boolean,
  name: string,
  options: RakeDbAst.ViewOptions,
  sql: string | RawExpression,
): RakeDbAst.View => {
  if (typeof sql === 'string') {
    sql = raw(sql);
  }

  return {
    type: 'view',
    action: up ? 'create' : 'drop',
    name,
    shape: {},
    sql,
    options,
  };
};

const astToQuery = (ast: RakeDbAst.View): Sql => {
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

    sql.push(`AS (${getRaw(ast.sql, values)})`);
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
