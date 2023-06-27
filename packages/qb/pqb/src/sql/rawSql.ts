import {
  ColumnTypeBase,
  ColumnTypesBase,
  RawSQLArgs,
  RawSQLBase,
  RawSQLValues,
  TemplateLiteralArgs,
  isTemplateLiteralArgs,
} from 'orchid-core';
import { DefaultColumnTypes } from '../columns';

const used: string[] = [];
const literalValues: number[] = [];

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

  toSQL(values: unknown[]): string {
    let sql;
    const isTemplate = typeof this._sql !== 'string';

    if (isTemplate) {
      sql = '';
      const template = this._sql;
      const parts = template[0];
      literalValues.length = 0;

      let i = 0;
      for (let last = parts.length - 1; i < last; i++) {
        values.push(template[i + 1]);
        sql += parts[i];

        if (template) literalValues.push(sql.length);

        sql += `$${values.length}`;
      }
      sql += parts[i];
    } else {
      sql = this._sql as string;
    }

    const data = this._values;
    if (!data) {
      return sql;
    }

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

export const raw = <T = unknown>(
  ...args: RawSQLArgs
): RawSQL<ColumnTypeBase<T>> =>
  isTemplateLiteralArgs(args)
    ? new RawSQL(args)
    : new RawSQL(args[0].raw, args[0].values);
