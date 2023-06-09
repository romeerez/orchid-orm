import { ColumnTypeBase } from './columns/columnType';

export type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

export type Sql = {
  text: string;
  values: unknown[];
};

export class RawExpression<C extends ColumnTypeBase = ColumnTypeBase> {
  constructor(
    readonly __raw: string | TemplateLiteralArgs,
    readonly __values?: Record<string, unknown> | false,
    readonly __column: C = undefined as unknown as C,
  ) {}

  /**
   * Static-cast untyped raw expression to the provided type.
   *
   * ```ts
   * db.sql`data->>'field'`.castTo<string>()
   * ```
   */
  castTo<T extends C['type']>(): RawExpression<
    ColumnTypeBase<T, C['operators'], C['inputType'], C['data']>
  > {
    return this as RawExpression<
      ColumnTypeBase<T, C['operators'], C['inputType'], C['data']>
    >;
  }
}

export const raw = <C extends ColumnTypeBase = ColumnTypeBase>(
  sql: string | TemplateLiteralArgs,
  values?: Record<string, unknown> | false,
  column?: C,
) => new RawExpression<C>(sql, values, column);

export const isRaw = (obj: object): obj is RawExpression =>
  obj instanceof RawExpression;

export const getRawSql = (raw: RawExpression) => {
  return raw.__raw;
};
