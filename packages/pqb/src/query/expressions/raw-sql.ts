import {
  DynamicSQLArg,
  Expression,
  ExpressionData,
  ExpressionTypeMethod,
  isTemplateLiteralArgs,
  RawSQLValues,
  StaticSQLArgs,
  TemplateLiteralArgs,
  templateLiteralSQLToCode,
} from './expression';
import { SqlRefExpression } from './sql-ref-expression';
import { Column } from '../../columns/column';
import { ColumnSchemaConfig } from '../../columns/column-schema';
import { DefaultColumnTypes } from '../../columns/column-types';
import { ToSQLCtx, ToSqlValues } from '../sql/to-sql';
import { emptyObject } from '../../utils';
import { PrepareSubQueryForSql } from '../sub-query/sub-query-for-sql';
import { SQLQueryArgs } from '../db-sql-query';

let prepareSubQueryForSql: PrepareSubQueryForSql;
export const setRawSqlPrepareSubQueryForSql = (fn: PrepareSubQueryForSql) => {
  prepareSubQueryForSql = fn;
};

// reuse array to track which variables were used in the SQL, to throw when there are some unused.
const used: string[] = [];
const literalValues: number[] = [];

export const templateLiteralToSQL = (
  template: TemplateLiteralArgs,
  ctx: ToSqlValues,
  quotedAs?: string,
): string => {
  let sql = '';
  const { values } = ctx;
  const parts = template[0];
  literalValues.length = 0;

  let i = 0;
  for (let last = parts.length - 1; i < last; i++) {
    sql += parts[i];

    const value = template[i + 1];
    if (value instanceof Expression) {
      sql += value.toSQL(ctx, quotedAs);
    } else {
      values.push(value);
      literalValues.push(sql.length);
      sql += `$${values.length}`;
    }
  }

  return sql + parts[i];
};

export interface RawSqlBase extends Expression {
  _sql: string | TemplateLiteralArgs;
  _values?: RawSQLValues;
}

// RawSql extends both Expression and ExpressionTypeMethod, so it needs a separate interface.
export interface RawSql<T extends Column.Pick.QueryColumn>
  extends Expression<T>,
    RawSqlBase,
    ExpressionTypeMethod {}

export class RawSql<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
> extends Expression<T> {
  // Column type instance, it is assigned directly to the prototype of RawSql class.
  declare result: { value: T };
  // Column types are stored to be passed to the `type` callback.
  declare columnTypes: ColumnTypes;
  q: ExpressionData;
  _sql: string | TemplateLiteralArgs;
  _values?: RawSQLValues;

  constructor(
    sql: string | TemplateLiteralArgs,
    values?: RawSQLValues,
    type?: T,
  ) {
    super();
    this.q = { expr: this };
    this._sql = sql;
    this._values = values;
    this.result = { value: type as T };
    if (type) {
      Object.assign(this, type.operators);
    }
  }

  // Attach query variables to the raw SQL.
  values<Self extends RawSqlBase>(this: Self, values: RawSQLValues): Self {
    this._values = values;
    return this;
  }

  // Produce SQL string, push query variables into given `values` array.
  makeSQL(ctx: ToSqlValues, quotedAs?: string): string {
    let sql;
    const isTemplate = typeof this._sql !== 'string';

    if (isTemplate) {
      sql = templateLiteralToSQL(
        this._sql as TemplateLiteralArgs,
        ctx,
        quotedAs,
      );
    } else {
      sql = this._sql as string;
    }

    const data = this._values;
    if (!data) {
      return sql;
    }

    const { values } = ctx;
    const arr = sql.split("'");
    const len = arr.length;
    used.length = 0;
    for (let i = 0; i < len; i += 2) {
      arr[i] = arr[i].replace(/\$\$?(\w+)/g, (match, key, i) => {
        if (isTemplate && literalValues.includes(i)) return match;

        const value = data[key];
        if (value === undefined) {
          throw new Error(`Query variable \`${key}\` is not provided`);
        }

        used.push(key);

        if (match.length - key.length === 2) {
          if (typeof value !== 'string') {
            throw new Error(
              `Expected string value for $$${key} SQL keyword, got ${typeof value}`,
            );
          }

          return `"${value.replace('"', '""').replace('.', '"."')}"`;
        }

        values.push(value);
        return `$${values.length}`;
      });
    }

    if (used.length > 0 && used.length < Object.keys(data).length) {
      for (const key in data) {
        if (!used.includes(key)) {
          throw new Error(`Query variable \`${key}\` is unused`);
        }
      }
    }

    return arr.join("'");
  }
}

// Check if something is a raw SQL.
export const isRawSQL = (arg: unknown): arg is RawSqlBase =>
  arg instanceof RawSql;

RawSql.prototype.type = ExpressionTypeMethod.prototype.type;

// Convert raw SQL to code for a code generator.
export const rawSqlToCode = (rawSql: RawSqlBase, t: string): string => {
  const { _sql: sql, _values: values } = rawSql;
  let code = `${t}.sql`;

  code +=
    typeof sql === 'string'
      ? `('${sql.replace(/'/g, "\\'")}')`
      : templateLiteralSQLToCode(sql);

  if (values) {
    code += `.values(${JSON.stringify(values)})`;
  }

  return code;
};

// `DynamicRawSQL` extends both `Expression` and `ExpressionTypeMethod`, so it needs a separate interface.
export interface DynamicRawSQL<T extends Column.Pick.QueryColumn>
  extends Expression<T>,
    ExpressionTypeMethod {}

// Calls the given function to get inner SQL each time when converting to SQL.
export class DynamicRawSQL<
  T extends Column.Pick.QueryColumn,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
> extends Expression<T> {
  declare columnTypes: ColumnTypes;
  result: { value: T } = emptyObject as { value: T };
  q: ExpressionData;
  dynamicBefore = true;

  constructor(public fn: DynamicSQLArg<T>) {
    super();
    this.q = { expr: this };
  }

  // Calls the given function to get SQL from it.
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const expr = this.fn(sql as never);
    this.q.beforeSet = this.q.before = undefined;
    const prepared = prepareSubQueryForSql(
      this,
      expr as never,
    ) as unknown as Expression;
    return prepared.toSQL(ctx, quotedAs);
  }
}

DynamicRawSQL.prototype.type = ExpressionTypeMethod.prototype.type;

// Raw SQL count(*) to apply directly to `QueryData.select`.
export const countSelect = [new RawSql('count(*)')];

export function sqlQueryArgsToExpression(args: SQLQueryArgs): RawSqlBase {
  return Array.isArray(args[0])
    ? new RawSql(args as TemplateLiteralArgs)
    : (args[0] as never);
}

export interface BaseSqlFn {
  /**
   * `sql.ref` quotes a SQL identifier such as a table name, column name, or schema name.
   * Use it when you need to dynamically reference an identifier in raw SQL.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const schema = 'my_schema';
   *
   * // Produces: SET LOCAL search_path TO "my_schema"
   * await db.$query`SET LOCAL search_path TO ${sql.ref(schema)}`
   * ```
   *
   * It handles dots to support qualified names:
   *
   * ```ts
   * // "my_schema"."my_table"
   * sql.ref('my_schema.my_table');
   * ```
   */
  ref(name: string): SqlRefExpression;
}

export interface SqlFn extends BaseSqlFn {
  <T>(this: T, ...args: StaticSQLArgs): RawSql<Column.Pick.QueryColumn, T>;
  <T>(
    this: T,
    fn: DynamicSQLArg<Column.Pick.QueryColumnOfType<T>>,
  ): DynamicRawSQL<Column.Pick.QueryColumn, T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql = ((...args) => {
  const arg = args[0];

  // Template literal: sql`...`
  if (isTemplateLiteralArgs(args)) {
    return new RawSql(args);
  }

  // Plain string: sql('raw string')
  if (typeof arg === 'string') {
    return new RawSql(arg);
  }

  // Dynamic function: sql(() => sql`...`)
  if (typeof arg === 'function') {
    return new DynamicRawSQL(arg);
  }

  // Object form: sql({ raw: '...', values?: {...} })
  if (typeof arg === 'object' && arg !== null && 'raw' in arg) {
    return new RawSql(
      arg.raw as string,
      arg.values as RawSQLValues | undefined,
    );
  }

  throw new Error('Invalid arguments for sql function');
}) as SqlFn;

sql.ref = (name) => new SqlRefExpression(name);

/**
 * @deprecated Use `sql` instead. Import from 'orchid-orm' or destructure from BaseTable.
 */
export const raw: SqlFn = sql;
