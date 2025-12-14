import { _queryGetOptional } from './get.utils';
import {
  Query,
  queryTypeWithLimitOne,
  SetQueryReturnsColumnOptional,
} from '../query/query';
import { ToSQLCtx } from '../sql';
import { Expression, ExpressionData } from '../core';
import { Column } from '../columns/column';
import { cloneQueryBaseUnscoped, queryWrap } from './queryMethods.utils';
import { UnknownColumn } from '../columns';
import { selectToSql } from '../sql/select';
import { getQueryAs } from '../common/utils';

class RowToJsonExpression extends Expression {
  q: ExpressionData;
  result = { value: UnknownColumn.instance };

  constructor(
    public from: Query,
    public one: boolean,
    public coalesce?: boolean,
  ) {
    super();
    this.q = { expr: this };
  }

  makeSQL(ctx: ToSQLCtx) {
    const q = this.from;
    const aliases: string[] = [];
    const jsonList: { [K: string]: Column | undefined } = {};
    const select = selectToSql(
      ctx,
      q,
      q.q,
      `"${getQueryAs(q)}"`,
      q.q.hookSelect,
      undefined,
      aliases,
      jsonList,
    );
    q.q.selectCache = { sql: select, aliases };

    let rowToJson: string;
    if (Object.values(jsonList).some((x) => x?.data.jsonCast)) {
      rowToJson = `json_build_object(${Object.entries(jsonList)
        .map(
          ([key, column]) =>
            `'${key}', t."${key}"${
              column?.data.jsonCast ? `::${column.data.jsonCast}` : ''
            }`,
        )
        .join(', ')})`;
    } else {
      rowToJson = 'row_to_json(t.*)';
    }

    return this.one
      ? rowToJson
      : this.coalesce !== false
      ? `COALESCE(json_agg(${rowToJson}), '[]')`
      : `json_agg(${rowToJson})`;
  }
}

export function queryJson<T>(
  self: T,
  coalesce?: boolean,
): SetQueryReturnsColumnOptional<T, Column.Pick.QueryColumnOfType<string>> {
  const inner = (self as Query).clone();

  const q = queryWrap(inner, cloneQueryBaseUnscoped(inner)) as unknown as Query;
  // json_agg is used instead of jsonb_agg because it is 2x faster, according to my benchmarks
  _queryGetOptional(
    q,
    new RowToJsonExpression(
      inner,
      queryTypeWithLimitOne[(self as Query).q.returnType as string],
      coalesce,
    ),
  );

  // to skip LIMIT 1
  q.q.returnsOne = true;

  return q as never;
}
