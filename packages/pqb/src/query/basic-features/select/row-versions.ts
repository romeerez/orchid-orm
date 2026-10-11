import {
  Column,
  ColumnSchemaConfig,
  ColumnsShape,
  internalSchemaConfig,
  JSONTextColumn,
  VirtualColumn,
} from '../../../columns';
import { emptyObject, getFreeAlias } from '../../../utils';
import { ColumnRefExpression } from '../../expressions/column-ref-expression';
import { PickQuerySelectable, PickQueryShape } from '../../pick-query-types';
import { Query } from '../../query';
import { ToSQLCtx } from '../../sql/to-sql';
import { _getQueryAliasOrName } from '../as/as';
import { simpleColumnToSQL } from '../../sql/column-to-sql';
import { makeRowToJson } from '../../sql/sql';
import { ColumnsParsers } from '../../query-columns/query-column-parsers';
import { parseRecord } from '../../then/then';

type RowVersion = 'old' | 'new';

export interface QueryHasRowVersions {
  __hasRowVersions: true;
}

export type OmitRowVersions<T> = T extends QueryHasRowVersions
  ? Omit<T, '__hasRowVersions'>
  : T;

type AvailableRowVersion<T extends PickQuerySelectable> = {
  [V in RowVersion]: Extract<
    keyof T['__selectable'],
    `${V}.${string}`
  > extends never
    ? V
    : never;
}[RowVersion];

// Keep row versions out of __selectable, which also controls WHERE and SET.
export type RowVersionSelectable<
  T extends PickQuerySelectable & PickQueryShape,
> = T extends QueryHasRowVersions & {
  columns: (infer K extends keyof T['shape'])[];
}
  ? T['__selectable'] & {
      [P in K &
        string as T['shape'][P] extends VirtualColumn<ColumnSchemaConfig>
        ? never
        : `${AvailableRowVersion<T>}.${P}`]: {
        as: P;
        column: T['shape'][P];
      };
    } & {
      [V in AvailableRowVersion<T> as `${V}.*`]: {
        as: V;
        column: ColumnsShape.MapToObjectColumn<{
          [P in K as T['shape'][P] extends
            | VirtualColumn<ColumnSchemaConfig>
            | { data: { explicitSelect?: true } }
            ? never
            : P]: T['shape'][P];
        }>;
      };
    }
  : T['__selectable'];

export interface UpdateReturningSql {
  empty: boolean;
  /** SQL names of selected row versions, renamed when a table hides them. */
  aliases?: Partial<Record<RowVersion, string>>;
}

class ReturningColumn extends ColumnRefExpression<Column.Pick.QueryColumn> {
  constructor(
    column: Column.Pick.QueryColumn,
    name: string,
    private version: RowVersion,
    private shape?: Column.Shape.Data,
  ) {
    super(column, name);
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const returning = ctx.updateReturning;
    if (!returning) {
      throw new Error('OLD/NEW columns can only be selected by UPDATE');
    }

    if (!returning.empty) {
      const aliases = (returning.aliases ??= {});
      let alias = aliases[this.version];
      if (!alias) {
        // Tables in FROM hide OLD and NEW with the same names.
        const occupied: Record<string, true> = {};
        if (quotedAs) occupied[quotedAs.slice(1, -1)] = true;
        // UPDATE renders joins only along with updateFrom.
        if (ctx.q.updateFrom) {
          for (const as in ctx.q.joinedShapes) {
            occupied[_getQueryAliasOrName(ctx.q, as)] = true;
          }
        }
        alias = aliases[this.version] = occupied[this.version]
          ? getFreeAlias(occupied, `__${this.version}`)
          : this.version;
      }
      quotedAs = `"${alias}"`;
    }

    if (this.shape) {
      return makeRowToJson(ctx, quotedAs!.slice(1, -1), this.shape, true);
    }

    return simpleColumnToSQL(
      ctx,
      emptyObject,
      emptyObject,
      this.name,
      this.result.value,
      quotedAs,
      true,
    );
  }
}

/**
 * Resolves an UPDATE `old.`/`new.` select string to a row-version expression.
 * Wildcards select a nested object of the row's default columns.
 * Returns `undefined` for other strings or existing table/join aliases,
 * which take precedence.
 * Throws for row-version references outside UPDATE or to non-physical columns.
 *
 * Call before regular selectable resolution, which treats the prefix as a
 * table name.
 */
export const getReturningColumn = (
  query: Query,
  arg: string,
): ReturningColumn | undefined => {
  if (arg.charCodeAt(3) !== 46) return; // '.'
  const version = arg.slice(0, 3);
  if (version !== 'old' && version !== 'new') return;

  const { q } = query;
  // Preserve existing table and join aliases named old or new.
  if (
    version === (q.as || query.table) ||
    q.joinedShapes?.[version] ||
    q.aliases?.[version]
  ) {
    return;
  }

  const name = arg.slice(4);
  if (q.type === 'update' && name === '*') {
    const shape: Column.Shape.Data = {};
    const parsers: ColumnsParsers = {};
    for (const key in query.shape) {
      const column = query.shape[key] as Column;
      if (column.data.virtual || column.data.computed) continue;
      shape[key] = column;
      if (!column.data.explicitSelect && column._parse) {
        parsers[key] = column._parse;
      }
    }

    const column = new JSONTextColumn(internalSchemaConfig, undefined);
    column._parse = (row) => parseRecord(parsers, row);
    return new ReturningColumn(column, version, version, shape);
  }

  const column = query.shape[name] as Column | undefined;
  if (
    q.type !== 'update' ||
    !column ||
    column.data.virtual ||
    column.data.computed
  ) {
    throw new Error('OLD/NEW selections require an UPDATE table column');
  }

  return new ReturningColumn(column, name, version);
};
