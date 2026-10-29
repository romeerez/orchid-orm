import { Query } from '../../query';
import { columnToSqlNotSelect } from '../../sql/column-to-sql';
import { JoinItemArgs, processJoinItem } from '../join/join.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { JoinedShapes, QueryData, QueryScopeData } from '../../query-data';
import { Column } from '../../../columns/column';
import { SelectItem, selectToSql } from '../select/select.sql';
import { OperatorToSQL } from '../../../columns/operators';
import { moveMutativeQueryToCte } from '../cte/cte.sql';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { _getQueryOuterAliases, getQueryAs, QueryDataAliases } from '../as/as';
import { ColumnsParsers } from '../../query-columns/query-column-parsers';
import { Expression, isExpression } from '../../expressions/expression';
import {
  addValue,
  MaybeArray,
  RecordString,
  RecordUnknown,
  toArray,
} from '../../../utils';
import { WhereSearchItem } from '../../extra-features/search/search.sql';
import { joinSubQuery } from '../join/join';
import { ColumnsShape } from '../../../columns';
import { isRelationCondition, RelationCondition } from './relation-conditions';
import { emptyNotInCondition } from './empty-in';

export type WhereItem =
  | {
      [K: string]:
        | unknown
        | { [K: string]: unknown | SubQueryForSql | Expression }
        | Expression;

      NOT?: MaybeArray<WhereItem>;
      AND?: MaybeArray<WhereItem>;
      OR?: MaybeArray<WhereItem>[];
      IN?: MaybeArray<WhereInItem>;
      EXISTS?: MaybeArray<JoinItemArgs>;
      ON?: WhereOnItem | WhereJsonPathEqualsItem;
      SEARCH?: MaybeArray<WhereSearchItem>;
    }
  | Query
  | Expression
  | RelationCondition;

export interface WhereInItem {
  columns: string[];
  values: unknown[][] | SubQueryForSql | Expression;
}

export type WhereJsonPathEqualsItem = [
  leftColumn: string,
  leftPath: string,
  rightColumn: string,
  rightPath: string,
];

export interface WhereOnItem {
  joinFrom: WhereOnJoinItem;
  from: string;
  joinTo: WhereOnJoinItem;
  to: string;
  useOuterAliases?: true;
  op?: string;
}

export type WhereOnJoinItem = { table?: string; q: { as?: string } } | string;

interface QueryDataForWhere extends QueryDataAliases {
  and?: QueryData['and'];
  or?: QueryData['or'];
  selectShape: QueryData['selectShape'];
  joinedShapes?: QueryData['joinedShapes'];
  scopes?: { [K: string]: QueryScopeData };
  outerAliases?: QueryData['outerAliases'];
  parsers?: ColumnsParsers;
  valuesJoinedAs?: RecordString;
}

interface QueryDataWithLanguage extends QueryDataForWhere {
  language?: QueryData['language'];
}

export const pushWhereStatementSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  checkIfHasExplicitWhere?: { value?: boolean },
) => {
  const res = whereToSql(
    ctx,
    table,
    query,
    quotedAs,
    undefined,
    checkIfHasExplicitWhere,
  );
  if (res) {
    ctx.sql.push('WHERE', res);
  }
};

export const pushWhereToSql = (
  sql: string[],
  ctx: ToSQLCtx,
  table: Query,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
) => {
  const res = whereToSql(ctx, table, query, quotedAs, parens);
  if (res) {
    sql.push(res);
  }
};

export const whereToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
  checkIfHasExplicitWhere?: { value?: boolean },
): string | undefined => {
  let sql: string | undefined;

  if (query.scopes) {
    sql = andOrToSql(ctx, table, query, quotedAs, true);

    if (checkIfHasExplicitWhere && sql && !matchesAllByEmptyNotIn(query)) {
      checkIfHasExplicitWhere.value = true;
    }

    const data = Object.create(query);
    for (const key in query.scopes) {
      const scope = query.scopes[key];
      const scopeResult = scope(table.baseQuery);
      data.and = scopeResult.and;
      data.or = scopeResult.or;
      const scopeSql = andOrToSql(ctx, table, data, quotedAs, true);
      if (scopeSql) {
        sql = sql ? sql + ' AND ' + scopeSql : scopeSql;

        if (
          checkIfHasExplicitWhere &&
          key !== 'default' &&
          key !== 'nonDeleted' &&
          !matchesAllByEmptyNotIn(data)
        ) {
          checkIfHasExplicitWhere.value = true;
        }
      }
    }
  } else {
    sql = andOrToSql(ctx, table, query, quotedAs, parens);

    if (checkIfHasExplicitWhere && sql && !matchesAllByEmptyNotIn(query)) {
      checkIfHasExplicitWhere.value = true;
    }
  }

  return sql;
};

const andOrToSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
): string | undefined => {
  let sql;
  if (query.or) {
    let userAnd: WhereItem[] | undefined;
    let relationAnd: WhereItem[] | undefined;
    if (query.and) {
      for (const item of query.and) {
        if (isRelationCondition(item)) (relationAnd ??= []).push(item);
        else (userAnd ??= []).push(item);
      }
    }

    // a group of only empty `whereNotIn` lists matches all records, so the user condition adds nothing
    if (
      !(userAnd && isMatchAllGroup(userAnd)) &&
      !query.or.some(isMatchAllGroup)
    ) {
      if (userAnd) sql = processAnds(userAnd, ctx, table, query, quotedAs);
      for (const and of query.or) {
        const orSql = processAnds(and, ctx, table, query, quotedAs);
        // skip groups that add no condition, such as `{ a: undefined }`
        if (orSql) sql = sql ? `${sql} OR ${orSql}` : orSql;
      }
    }

    // `orWhere` must not bypass conditions of a relation
    const relationSql =
      relationAnd && processAnds(relationAnd, ctx, table, query, quotedAs);
    if (relationSql) {
      sql = sql ? `(${sql}) AND ${relationSql}` : relationSql;
    }
  } else if (query.and) {
    sql = processAnds(query.and, ctx, table, query, quotedAs);
  } else {
    return;
  }

  return parens && sql ? `(${sql})` : sql;
};

const isEmptyNotIn = (item: WhereItem) => item === emptyNotInCondition;

/**
 * Whether the `and` group has only empty `whereNotIn` lists, so it matches all records.
 */
const isMatchAllGroup = (and: WhereItem[]) => and.every(isEmptyNotIn);

/**
 * Whether an empty `whereNotIn` or `notIn` list makes the user condition match all records,
 * so the condition doesn't permit `update` or `delete`.
 * It reads only the top-level conditions: SQL of an empty `notIn` list is `true`, which keeps its meaning in nested conditions.
 */
const matchesAllByEmptyNotIn = ({ and, or }: QueryDataForWhere) =>
  // a relation condition limits the records
  !and?.some(isRelationCondition) &&
  ((!!and && isUnrestrictedGroup(and)) || !!or?.some(isUnrestrictedGroup));

/**
 * Whether the `and` group has an empty `whereNotIn` or `notIn` list, and its other conditions add nothing, such as `{ a: undefined }`.
 */
const isUnrestrictedGroup = (and: WhereItem[]) => {
  let hasEmptyNotIn = false;
  for (const item of and) {
    if (item === emptyNotInCondition) {
      hasEmptyNotIn = true;
      continue;
    }

    if (!isColumnConditions(item)) return false;

    for (const key in item) {
      const value = item[key];
      if (value === undefined) continue;

      // a special key such as `NOT` holds conditions rather than operators
      if (whereSpecialKeys.has(key) || !isColumnOperators(value)) return false;

      for (const op in value) {
        const arg = value[op];
        if (arg === undefined) continue;

        if (op !== 'notIn' || !Array.isArray(arg) || arg.length) return false;
        hasEmptyNotIn = true;
      }
    }
  }
  return hasEmptyNotIn;
};

/**
 * Whether `processWhere` reads the `where` item as conditions of columns, such as `{ id: 1 }`,
 * rather than as a relation condition, a sub-query, or an expression.
 */
const isColumnConditions = (item: WhereItem): item is RecordUnknown =>
  !isRelationCondition(item) &&
  !('prototype' in item) &&
  !('baseQuery' in item) &&
  !isExpression(item);

/**
 * Whether `processWhere` reads the value of a column condition as operators, such as `{ gt: 5 }`,
 * rather than as a value to compare with `=`, a sub-query, or an expression.
 */
const isColumnOperators = (value: unknown): value is RecordUnknown =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Date) &&
  !Array.isArray(value) &&
  !('baseQuery' in value) &&
  !isExpression(value);

const whereSpecialKeys = new Set([
  'AND',
  'OR',
  'NOT',
  'ON',
  'IN',
  'EXISTS',
  'SEARCH',
]);

const processAnds = (
  and: WhereItem[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataForWhere,
  quotedAs?: string,
  parens?: boolean,
): string | undefined => {
  const ands: string[] = [];
  for (const data of and) {
    processWhere(ands, ctx, table, query, data, quotedAs);
  }
  if (!ands.length) return;

  const sql = ands.join(' AND ');
  return parens && ands.length > 1 ? `(${sql})` : sql;
};

const processWhere = (
  ands: string[],
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryDataWithLanguage,
  data: WhereItem,
  quotedAs?: string,
) => {
  if (isRelationCondition(data)) {
    processWhere(ands, ctx, table, query, data.condition, quotedAs);
    return;
  }

  if ('prototype' in data || 'baseQuery' in data) {
    const query = data as Query;
    if (query.q.expr) {
      if (query.q.subQuery === 1) {
        ands.push(selectToSql(ctx, table, query.q, quotedAs));
      } else {
        const q = joinSubQuery(table, query);
        q.q.select = [query.q.expr];
        ands.push(`(${moveMutativeQueryToCte(ctx, q)})`);
      }
    } else {
      const as = getQueryAs(query);
      pushWhereToSql(ands, ctx, query, query.q, as && `"${as}"`, true);
    }
    return;
  }

  if (isExpression(data)) {
    // an empty `whereNotIn` list matches all records, so it adds nothing to other conditions,
    // and it doesn't permit `update` or `delete`
    if (data !== emptyNotInCondition) {
      ands.push(`(${data.toSQL(ctx, quotedAs)})`);
    }
    return;
  }

  for (const key in data) {
    const value = (data as RecordUnknown)[key];
    if (value === undefined) continue;

    if (key === 'AND') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      const sql = processAnds(arr, ctx, table, query, quotedAs);
      if (sql) ands.push(sql);
    } else if (key === 'OR') {
      const arr = (value as MaybeArray<WhereItem>[]).map(toArray);
      const sqls = arr.reduce<string[]>((acc, and) => {
        const sql = processAnds(and, ctx, table, query, quotedAs);
        if (sql) acc.push(sql);
        return acc;
      }, []);
      if (sqls.length) ands.push(`(${sqls.join(' OR ')})`);
    } else if (key === 'NOT') {
      const arr = toArray(value as MaybeArray<WhereItem>);
      ands.push(`NOT ${processAnds(arr, ctx, table, query, quotedAs, true)}`);
    } else if (key === 'ON') {
      if (Array.isArray(value)) {
        const item = value as WhereJsonPathEqualsItem;
        const leftColumn = columnToSqlNotSelect(
          ctx,
          query,
          query.selectShape,
          item[0],
          quotedAs,
        );

        const leftPath = item[1];
        const rightColumn = columnToSqlNotSelect(
          ctx,
          query,
          query.selectShape,
          item[2],
          quotedAs,
        );

        const rightPath = item[3];

        ands.push(
          `jsonb_path_query_first(${leftColumn}, ${addValue(
            ctx.values,
            leftPath,
          )}) = jsonb_path_query_first(${rightColumn}, ${addValue(
            ctx.values,
            rightPath,
          )})`,
        );
      } else {
        const item = value as WhereOnItem;
        const joinAs = `"${getJoinItemSource(item.joinFrom)}"`;

        const q: OnColumnToSQLQuery = item.useOuterAliases
          ? {
              joinedShapes: query.joinedShapes,
              aliases: _getQueryOuterAliases(query),
              selectShape: query.selectShape,
            }
          : query;

        ands.push(
          `${onColumnToSql(ctx, q, joinAs, item.from)} ${
            item.op || '='
          } ${onColumnToSql(ctx, q, joinAs, item.to)}`,
        );
      }
    } else if (key === 'IN') {
      toArray(value as MaybeArray<WhereInItem>).forEach((item) => {
        pushIn(ctx, query, ands, quotedAs, item);
      });
    } else if (key === 'EXISTS') {
      const joinItems = (
        Array.isArray((value as unknown[])[0]) ? value : [value]
      ) as JoinItemArgs[];

      const joinSet = joinItems.length > 1 ? new Set<string>() : null;

      for (const args of joinItems) {
        const { target, on } = processJoinItem(
          ctx,
          table,
          query,
          args,
          quotedAs,
          true,
        );

        const sql = `EXISTS (SELECT 1 FROM ${target}${
          on ? ` WHERE ${on}` : ''
        })`;
        if (joinSet) {
          if (joinSet.has(sql)) continue;
          joinSet.add(sql);
        }

        ands.push(sql);
      }
    } else if (key === 'SEARCH') {
      const search = value as WhereSearchItem;
      ands.push(`${search.vectorSQL} @@ "${search.as}"`);
    } else if (
      typeof value === 'object' &&
      value &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      whereExprOrQuery(ctx, ands, query, key, value, quotedAs);
    } else {
      const column = columnToSqlNotSelect(
        ctx,
        query,
        query.selectShape,
        key,
        quotedAs,
      );
      ands.push(
        `${column} ${
          value === null ? 'IS NULL' : `= ${addValue(ctx.values, value)}`
        }`,
      );
    }
  }
};

const whereExprOrQuery = (
  ctx: ToSQLCtx,
  ands: string[],
  query: QueryDataForWhere,
  key: string,
  value: object,
  quotedAs?: string,
) => {
  if (isExpression(value)) {
    ands.push(
      `${columnToSqlNotSelect(
        ctx,
        query,
        query.selectShape,
        key,
        quotedAs,
      )} = ${value.toSQL(ctx, quotedAs)}`,
    );
  } else {
    let column: Column.Pick.QueryColumn | undefined = query.selectShape[key];
    if (!column) {
      const index = key.indexOf('.');
      if (index === -1) {
        column = query.joinedShapes?.[key]?.value;
      } else if (index !== -1) {
        const table = key.slice(0, index);
        const name = key.slice(index + 1);
        const quoted = `"${table}"`;

        column = (
          quotedAs === quoted
            ? query.selectShape[name]
            : query.joinedShapes?.[table]?.[name]
        ) as typeof column;
      }
    }

    if (!column) {
      throw new Error(`Unknown column ${key} provided to condition`);
    }

    const quotedColumn = columnToSqlNotSelect(
      ctx,
      query,
      query.selectShape,
      key,
      quotedAs,
    );

    if (value instanceof ctx.qb.constructor) {
      const subQuerySql = moveMutativeQueryToCte(ctx, value as SubQueryForSql);

      ands.push(`${quotedColumn} = (${subQuerySql})`);
    } else {
      for (const op in value) {
        const operator = (column.operators as RecordUnknown)[op];
        if (!operator) {
          throw new Error(`Unknown operator ${op} provided to condition`);
        }

        if (value[op as keyof typeof value] === undefined) continue;

        ands.push(
          `${(operator as unknown as { _op: OperatorToSQL })._op(
            quotedColumn as string,
            value[op as keyof typeof value],
            ctx,
            quotedAs,
          )}`,
        );
      }
    }
  }
};

interface OnColumnToSQLQuery {
  joinedShapes?: QueryData['joinedShapes'];
  aliases?: QueryData['aliases'];
  selectShape: ColumnsShape;
  select?: SelectItem[];
}

const onColumnToSql = (
  ctx: ToSQLCtx,
  query: OnColumnToSQLQuery,
  joinAs: string,
  column: string,
) => columnToSqlNotSelect(ctx, query, query.selectShape, column, joinAs);

const getJoinItemSource = (joinItem: WhereOnJoinItem) => {
  return typeof joinItem === 'string' ? joinItem : getQueryAs(joinItem);
};

const pushIn = (
  ctx: ToSQLCtx,
  query: {
    selectShape: ColumnsShape;
    joinedShapes?: JoinedShapes;
    select?: SelectItem[];
  },
  ands: string[],
  quotedAs: string | undefined,
  arg: {
    columns: string[];
    values: unknown[][] | SubQueryForSql | Expression;
  },
) => {
  // if there are multiple columns, make `(col1, col2) IN ((1, 2), (3, 4))`,
  // otherwise, make `col IN (1, 2, 3)`
  const multiple = arg.columns.length > 1;

  let value: string;

  if (Array.isArray(arg.values)) {
    value = `${arg.values
      .map(
        multiple
          ? (arr) =>
              `(${arr.map((value) => addValue(ctx.values, value)).join(', ')})`
          : (arr) =>
              `${arr.map((value) => addValue(ctx.values, value)).join(', ')}`,
      )
      .join(', ')}`;

    value = `(${value})`;
  } else if (isExpression(arg.values)) {
    value = arg.values.toSQL(ctx, quotedAs);
  } else {
    value = `(${moveMutativeQueryToCte(ctx, arg.values)})`;
  }

  const columnsSql = arg.columns
    .map((column) =>
      columnToSqlNotSelect(ctx, query, query.selectShape, column, quotedAs),
    )
    .join(', ');

  ands.push(`${multiple ? `(${columnsSql})` : columnsSql} IN ${value}`);
};
