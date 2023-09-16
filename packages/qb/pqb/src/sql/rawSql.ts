import {
  ColumnTypeBase,
  ColumnTypesBase,
  SQLArgs,
  RawSQLBase,
  RawSQLValues,
  TemplateLiteralArgs,
  isTemplateLiteralArgs,
  DynamicSQLArg,
  Expression,
  ExpressionTypeMethod,
  StaticSQLArgs,
} from 'orchid-core';
import { DefaultColumnTypes } from '../columns';
import { ToSQLCtx } from './toSQL';

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
  T extends ColumnTypeBase,
  CT extends ColumnTypesBase = DefaultColumnTypes,
> extends RawSQLBase<T> {
  declare columnTypes: CT;

  constructor(
    sql: string | TemplateLiteralArgs,
    values?: RawSQLValues,
    type?: T,
  ) {
    super(sql, values);
    if (type) this._type = type;
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
export interface DynamicRawSQL<T extends ColumnTypeBase>
  extends Expression<T>,
    ExpressionTypeMethod {}

// Calls the given function to get inner SQL each time when converting to SQL.
export class DynamicRawSQL<
  T extends ColumnTypeBase,
  CT extends ColumnTypesBase = DefaultColumnTypes,
> extends Expression<T> {
  declare _type: T;
  declare columnTypes: CT;

  constructor(public fn: DynamicSQLArg) {
    super();
  }

  // Calls the given function to get SQL from it.
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return this.fn(raw).toSQL(ctx, quotedAs);
  }
}

DynamicRawSQL.prototype.type = ExpressionTypeMethod.prototype.type;

export function raw<T = unknown>(
  ...args: StaticSQLArgs
): RawSQL<ColumnTypeBase<T>>;
export function raw<T = unknown>(
  ...args: [DynamicSQLArg]
): DynamicRawSQL<ColumnTypeBase<T>>;
export function raw(...args: SQLArgs) {
  return isTemplateLiteralArgs(args)
    ? new RawSQL(args)
    : typeof args[0] === 'function'
    ? new DynamicRawSQL(args[0])
    : new RawSQL(args[0].raw, args[0].values);
}

// Raw SQL count(*) to apply directly to `QueryData.select`.
export const countSelect = [new RawSQL('count(*)')];
