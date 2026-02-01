import { columnToSql, rawOrColumnToSql } from '../../sql/column-to-sql';
import { IsQuery, Query } from '../../query';
import { whereToSql } from '../where/where.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import {
  JoinedShapes,
  PickQueryDataShapeAndJoinedShapes,
  PickQueryDataShapeAndJoinedShapesAndAliases,
  QueryData,
} from '../../query-data';
import { RawSql } from '../../expressions/raw-sql';
import { Column } from '../../../columns/column';
import { moveMutativeQueryToCte } from '../cte/cte.sql';
import { Expression, isExpression } from '../../expressions/expression';
import { _getQueryAliasOrName, getQueryAs } from '../as/as';
import { addValue, RecordUnknown } from '../../../utils';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import {
  quoteFromWithSchema,
  quoteTableWithSchema,
  requireTableOrStringFrom,
} from '../../sql/sql';

export type SimpleJoinItemNonSubQueryArgs =
  | [{ [K: string]: string | Expression } | Expression | true]
  | [leftColumn: string | Expression, rightColumn: string | Expression]
  | [
      leftColumn: string | Expression,
      op: string,
      rightColumn: string | Expression,
    ];

export type JoinItemArgs =
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // lateral join query
      l: SubQueryForSql;
      // as
      a: string;
      // "inner join" by checking `IS NOT NULL` in the `ON`
      i?: boolean;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // relation query from `relation.joinQuery`
      j: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
      // callback result, if callback is present
      r?: IsQuery;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // `with` item name
      w: string;
      // callback result
      r: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // `with` item name
      w: string;
      // join arguments
      a: SimpleJoinItemNonSubQueryArgs;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // joining query
      q: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // joining query
      q: IsQuery;
      // callback result
      r: IsQuery;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c?: Column.QueryColumns;
      // joining query
      q: IsQuery;
      // join arguments
      a: SimpleJoinItemNonSubQueryArgs;
      // join a sub query, is not applicable in whereExists
      s: boolean;
    }
  | {
      // `updateFrom`: forbid LATERAL
      u?: true;
      c: Column.Shape.Data;
      // alias
      a: string;
      // array of values, item is a record
      d: RecordUnknown[];
    };

export interface JoinItem {
  type: string;
  args: JoinItemArgs;
}

type ItemOf2Or3Length =
  | [leftColumn: string | Expression, rightColumn: string | Expression]
  | [
      leftColumn: string | Expression,
      op: string,
      rightColumn?: string | Expression,
    ];

interface SqlJoinItem {
  target: string;
  on?: string;
}

export const processJoinItem = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: PickQueryDataShapeAndJoinedShapesAndAliases,
  args: JoinItemArgs,
  quotedAs: string | undefined,
): SqlJoinItem => {
  let target: string;
  let on: string | undefined;

  const forbidLateral = 'u' in args;

  // lateral
  if ('l' in args) {
    const { aliasValue } = ctx;
    ctx.aliasValue = true;

    target = `(${moveMutativeQueryToCte(ctx, args.l)}) "${_getQueryAliasOrName(
      query,
      args.a,
    )}"`;

    on = `${args.i ? `"${args.a}"."${args.a}" IS NOT NULL` : 'true'}`;

    ctx.aliasValue = aliasValue;
  } else if ('j' in args) {
    const { j, s, r } = args as {
      j: SubQueryForSql;
      s: boolean;
      r?: Query;
    };

    const tableName = (
      typeof j.q.from === 'string' ? j.q.from : j.table
    ) as string;

    const joinTable = requireTableOrStringFrom(j);
    target = quoteFromWithSchema(j.q.schema, joinTable);

    const as = j.q.as as string;
    const joinAs = `"${as}"`;
    if (as !== tableName) {
      target += ` ${joinAs}`;
    }

    if (r && s) {
      target = subJoinToSql(
        ctx,
        j,
        `"${joinTable}"`,
        !forbidLateral,
        joinAs,
        true,
      );
    } else {
      on = whereToSql(ctx, j, j.q, joinAs);
    }
  } else if ('w' in args) {
    const { w } = args;
    target = `"${w}"`;

    if ('r' in args) {
      const { s, r } = args as {
        w: string;
        s: boolean;
        r: SubQueryForSql;
      };
      if (s) {
        target = subJoinToSql(ctx, r, target, !forbidLateral, target);
      } else {
        on = whereToSql(ctx, r as unknown as Query, r.q, target);
      }
    } else {
      on = processArgs(
        args.a,
        ctx,
        query,
        target,
        (query.joinedShapes as JoinedShapes)[w],
        quotedAs,
      );
    }
  } else if ('d' in args) {
    const shape = args.c;
    const { values } = ctx;

    target = `(VALUES ${args.d
      .map((x) => {
        return (
          '(' +
          Object.entries(shape)
            .map(([key, column]) => {
              const value = x[key];
              return (
                addValue(
                  values,
                  value === null || value === undefined
                    ? null
                    : column.data.encode
                    ? column.data.encode(value)
                    : value,
                ) +
                '::' +
                (column as Column).dataType
              );
            })
            .join(', ') +
          ')'
        );
      })
      .join(', ')}) "${args.a}"(${Object.entries(shape)
      .map(([key, column]) => `"${column.data.name || key}"`)
      .join(', ')})`;
  } else {
    const { q, s } = args as {
      q: SubQueryForSql;
      s: boolean;
    };
    let joinAs;

    if ('r' in args) {
      const { r } = args as {
        q: Query;
        s: boolean;
        r: Query;
      };

      const res = getArgQueryTarget(ctx, q, s && !forbidLateral, s, s);
      target = res.target;
      joinAs = res.joinAs;

      if (!s || forbidLateral) {
        on = whereToSql(ctx, r, r.q, `"${getQueryAs(r)}"`);
      }
    } else {
      const res = getArgQueryTarget(ctx, q, false, s);
      target = res.target;
      joinAs = res.joinAs;

      if ('a' in args) {
        on = processArgs(args.a, ctx, query, joinAs, q.shape, quotedAs);
      }
    }

    // if it's a sub query, WHERE conditions are already in the sub query
    if (!s) {
      const whereSql = whereToSql(
        ctx,
        q,
        {
          ...q.q,
          joinedShapes: {
            ...query.joinedShapes,
            ...q.q.joinedShapes,
            [(table.q.as || table.table) as string]: table.q.shape,
          },
        },
        joinAs,
      );
      if (whereSql) {
        if (on) on += ` AND ${whereSql}`;
        else on = whereSql;
      }
    }
  }

  return { target, on };
};

const getArgQueryTarget = (
  ctx: ToSQLCtx,
  first: SubQueryForSql,
  lateral: boolean,
  joinSubQuery: boolean,
  cloned?: boolean,
) => {
  const joinQuery = first.q;

  const quotedFrom =
    typeof joinQuery.from === 'string' ? `"${joinQuery.from}"` : undefined;

  let joinAs = quotedFrom || `"${first.table}"`;

  const qAs = joinQuery.as ? `"${joinQuery.as}"` : undefined;
  const addAs = qAs && qAs !== joinAs;

  if (joinSubQuery) {
    return {
      target: subJoinToSql(ctx, first, joinAs, lateral, qAs, cloned),
      joinAs: addAs ? qAs : joinAs,
    };
  } else {
    let target = quotedFrom || quoteTableWithSchema(first);
    if (addAs) {
      joinAs = qAs;
      target += ` ${qAs}`;
    }
    return { target, joinAs };
  }
};

const subJoinToSql = (
  ctx: ToSQLCtx,
  jq: SubQueryForSql,
  innerAs: string,
  lateral: boolean,
  outerAs?: string,
  cloned?: boolean,
) => {
  if (!jq.q.select && jq.q.selectAllColumns) {
    if (!cloned) jq = jq.clone();
    jq.q.select = [new RawSql(`${innerAs}.*`)];
  }

  const sql = `(${moveMutativeQueryToCte(ctx, jq)}) ${outerAs || innerAs}`;
  return lateral ? `LATERAL ${sql}` : sql;
};

const processArgs = (
  args: SimpleJoinItemNonSubQueryArgs,
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  joinAs: string,
  joinShape: Column.QueryColumns,
  quotedAs?: string,
): string | undefined => {
  return args.length
    ? args.length === 1
      ? getObjectOrRawConditions(
          ctx,
          query,
          args[0],
          quotedAs,
          joinAs,
          joinShape,
        )
      : getConditionsFor3Or4LengthItem(
          ctx,
          query,
          joinAs,
          quotedAs,
          args as ItemOf2Or3Length,
          joinShape,
        )
    : undefined;
};

const getConditionsFor3Or4LengthItem = (
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  target: string,
  quotedAs: string | undefined,
  args: ItemOf2Or3Length,
  joinShape: Column.QueryColumns,
): string => {
  const [leftColumn, opOrRightColumn, maybeRightColumn] = args;

  const op = maybeRightColumn ? opOrRightColumn : '=';
  const rightColumn = maybeRightColumn ? maybeRightColumn : opOrRightColumn;

  return `${rawOrColumnToSql(
    ctx,
    query,
    leftColumn,
    target,
    joinShape,
  )} ${op} ${rawOrColumnToSql(ctx, query, rightColumn, quotedAs, query.shape)}`;
};

const getObjectOrRawConditions = (
  ctx: ToSQLCtx,
  query: PickQueryDataShapeAndJoinedShapes,
  data: { [K: string]: string | Expression } | Expression | true,
  quotedAs: string | undefined,
  joinAs: string,
  joinShape: Column.QueryColumns,
): string => {
  if (data === true) {
    return 'true';
  } else if (isExpression(data)) {
    return data.toSQL(ctx, quotedAs);
  } else {
    const pairs: string[] = [];
    const shape = query.shape;

    for (const key in data) {
      const value = data[key];

      pairs.push(
        `${columnToSql(
          ctx,
          query,
          joinShape,
          key,
          joinAs,
        )} = ${rawOrColumnToSql(ctx, query, value, quotedAs, shape)}`,
      );
    }

    return pairs.join(', ');
  }
};

export const pushJoinSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData & {
    join: JoinItem[];
  },
  quotedAs?: string,
) => {
  const joinSet = query.join.length > 1 ? new Set<string>() : null;

  for (const item of query.join) {
    const { target, on = 'true' } = processJoinItem(
      ctx,
      table,
      query,
      item.args,
      quotedAs,
    );

    const sql = `${item.type} ${target} ON ${on}`;

    if (joinSet) {
      if (joinSet.has(sql)) continue;
      joinSet.add(sql);
    }

    ctx.sql.push(sql);
  }
};
