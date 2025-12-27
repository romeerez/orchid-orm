import {
  DynamicSQLArg,
  Expression,
  ExpressionData,
  ExpressionTypeMethod,
  isTemplateLiteralArgs,
  RawSQLValues,
  SQLArgs,
  StaticSQLArgs,
  TemplateLiteralArgs,
  templateLiteralSQLToCode,
} from './expression';
import { Column } from '../../columns/column';
import { ColumnSchemaConfig } from '../../columns/column-schema';
import { DefaultColumnTypes } from '../../columns/column-types';
import { ToSQLCtx } from '../sql/to-sql';
import { emptyObject, RecordUnknown } from '../../utils';
import { PrepareSubQueryForSql } from '../sub-query/sub-query-for-sql';
import { SQLQueryArgs } from '../db-sql-query';

let prepareSubQueryForSql: PrepareSubQueryForSql;
export const setRawSqlPrepareSubQueryForSql = (fn: PrepareSubQueryForSql) => {
  prepareSubQueryForSql = fn;
};

// RawSQLBase extends both Expression and ExpressionTypeMethod, so it needs a separate interface.
export interface RawSQLBase<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
  ColumnTypes = unknown,
> extends Expression<T>,
    ExpressionTypeMethod {}

// Base class for raw SQL
// TODO: to be merged into a single RawSQL class
export abstract class RawSQLBase<
  T extends Column.Pick.QueryColumn = Column.Pick.QueryColumn,
  ColumnTypes = unknown,
> extends Expression<T> {
  // Column type instance, it is assigned directly to the prototype of RawSQL class.
  declare result: { value: T };
  q: ExpressionData;

  // Column types are stored to be passed to the `type` callback.
  abstract columnTypes: ColumnTypes;

  // Produce SQL string, push query variables into given `values` array.
  abstract makeSQL(ctx: { values: unknown[] }): string;

  constructor(
    public _sql: string | TemplateLiteralArgs,
    public _values?: RawSQLValues,
  ) {
    super();
    this.q = { expr: this };
  }

  // Attach query variables to the raw SQL.
  values<Self extends RawSQLBase>(this: Self, values: RawSQLValues): Self {
    this._values = values;
    return this;
  }

  // Convert raw SQL to code for a code generator.
  toCode(t: string): string {
    const { _sql: sql, _values: values } = this;
    let code = `${t}.sql`;

    code +=
      typeof sql === 'string'
        ? `({ raw: '${sql.replace(/'/g, "\\'")}' })`
        : templateLiteralSQLToCode(sql);

    if (values) {
      code += `.values(${JSON.stringify(values)})`;
    }

    return code;
  }
}

RawSQLBase.prototype.type = ExpressionTypeMethod.prototype.type;
// Check if something is a raw SQL.
export const isRawSQL = (arg: unknown): arg is RawSQLBase =>
  arg instanceof RawSQLBase;

// reuse array to track which variables were used in the SQL, to throw when there are some unused.
const used: string[] = [];
const literalValues: number[] = [];

export const templateLiteralToSQL = (
  template: TemplateLiteralArgs,
  ctx: ToSQLCtx,
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

export class RawSQL<
  T extends Column.Pick.QueryColumn,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
> extends RawSQLBase<T, ColumnTypes> {
  declare columnTypes: ColumnTypes;

  constructor(
    sql: string | TemplateLiteralArgs,
    values?: RawSQLValues,
    type?: T,
  ) {
    super(sql, values);
    this.result = { value: type as T };
    if (type) {
      Object.assign(this, type.operators);
    }
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
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
    const expr = this.fn(raw as never);
    this.q.beforeSet = this.q.before = undefined;
    const prepared = prepareSubQueryForSql(
      this,
      expr as never,
    ) as unknown as Expression;
    return prepared.toSQL(ctx, quotedAs);
  }
}

DynamicRawSQL.prototype.type = ExpressionTypeMethod.prototype.type;

export function raw<T = never>(
  ...args: StaticSQLArgs
): RawSQL<Column.Pick.QueryColumnOfType<T>>;
export function raw<T = never>(
  ...args: [DynamicSQLArg<Column.Pick.QueryColumnOfType<T>>]
): DynamicRawSQL<Column.Pick.QueryColumnOfType<T>>;
export function raw(...args: SQLArgs) {
  return isTemplateLiteralArgs(args)
    ? new RawSQL(args)
    : typeof args[0] === 'function'
    ? new DynamicRawSQL(args[0])
    : new RawSQL(args[0].raw, args[0].values);
}

// Raw SQL count(*) to apply directly to `QueryData.select`.
export const countSelect = [new RawSQL('count(*)')];

export function sqlQueryArgsToExpression(
  args: SQLQueryArgs,
): RawSQL<Column.Pick.QueryColumn> {
  return Array.isArray(args[0])
    ? new RawSQL(args as TemplateLiteralArgs)
    : (args[0] as never);
}

export interface SqlFn {
  <
    T,
    Args extends
      | [sql: TemplateStringsArray, ...values: unknown[]]
      | [sql: string]
      | [values: RecordUnknown, sql?: string],
  >(
    this: T,
    ...args: Args
  ): Args extends [RecordUnknown]
    ? (...sql: TemplateLiteralArgs) => RawSQLBase<Column.Pick.QueryColumn, T>
    : RawSQLBase<Column.Pick.QueryColumn, T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sqlFn: SqlFn = (...args: any[]): any => {
  const arg = args[0];
  if (Array.isArray(arg)) {
    return new RawSQL(args as TemplateLiteralArgs);
  }

  if (typeof args[0] === 'string') {
    return new RawSQL(args[0]);
  }

  if (args[1] !== undefined) {
    return new RawSQL(args[1], arg);
  }

  return (...args: TemplateLiteralArgs) =>
    new RawSQL(args, arg as RecordUnknown);
};
