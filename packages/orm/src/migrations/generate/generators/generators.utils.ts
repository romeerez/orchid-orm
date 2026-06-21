import { RakeDbAst, promptSelect } from 'rake-db';
import {
  type RawSqlBase,
  type QueryInternal,
  type SingleSql,
  QueryResult,
  Adapter,
  colors,
  TransactionAdapter,
  getDriverErrorCode,
  queryToSql,
  rawSqlToSql,
  sqlToRawSql,
} from 'pqb/internal';
import { AbortSignal } from '../generate';

export interface CompareExpression {
  compare: {
    inDb: string;
    inCode: (string | RawSqlBase)[];
  }[];

  handle(i?: number): void;
}

export interface SqlExpression extends CompareExpression {
  source?: string;
}

export const viewDataToSql = (
  viewData: NonNullable<QueryInternal['viewData']>,
  viewName: string,
): RawSqlBase => {
  return sqlToRawSql(viewDataToQuerySql(viewData, viewName));
};

const viewDataToQuerySql = (
  viewData: NonNullable<QueryInternal['viewData']>,
  viewName: string,
): SingleSql => {
  if (viewData.query) return queryToSql(viewData.query);
  if (viewData.sql !== undefined) return rawSqlToSql(viewData.sql);

  throw new Error(`Either sql or query is required for view ${viewName}`);
};

export const compareSqlExpressions = async (
  expressions: SqlExpression[],
  adapter: Adapter | TransactionAdapter,
) => {
  if (!expressions.length) return;

  let id = 1;
  for (const { source, compare, handle } of expressions) {
    const viewName = `orchidTmpView${id++}`;
    const values: unknown[] = [];

    // It is important to run `CREATE TEMPORARY VIEW` and `DROP VIEW` on the same db connection,
    // that's why SQLs are combined into a single query.
    const combinedQueries = [
      `CREATE TEMPORARY VIEW ${viewName} AS (SELECT ${compare
        .map(
          ({ inDb, inCode }, i): string =>
            `${inDb} AS "*inDb-${i}*", ${inCode
              .map(
                (s, j) =>
                  `(${
                    typeof s === 'string' ? s : s.toSQL({ values })
                  }) "*inCode-${i}-${j}*"`,
              )
              .join(', ')}`,
        )
        .join(', ')}${source ? ` FROM ${source}` : ''})`,
      `SELECT pg_get_viewdef('${viewName}') v`,
      `DROP VIEW ${viewName}`,
    ].join('; ');

    const query = () => adapter.query(combinedQueries, values);

    const result = await (
      adapter.isInTransaction() ? adapter.savepoint(viewName, query) : query()
    ).then(
      (res) => (res as unknown as QueryResult[])[1],
      async (err) => {
        // ignore the "type ... does not exist" because the type may be added in the same migration,
        // but throw on other errors
        if (typeof err === 'object' && getDriverErrorCode(err) !== '42704') {
          throw err;
        }
      },
    );

    if (!result) {
      handle();
      return;
    }

    const match = compareSqlExpressionResult(
      result.rows[0].v,
      compare[0].inCode,
    );
    handle(match);
  }
};

export interface CompareViewExpression {
  inDb: string;
  inCode: string;
  ast: RakeDbAst.View | RakeDbAst.MaterializedView;
  onNotEqual(): void;
}

export const compareViewsExpressions = async (
  adapter: Adapter,
  compare: CompareViewExpression[],
) => {
  if (!compare.length) return;

  const queries: { batch: string[] }[] = [];

  let id = 1;
  compare.forEach(({ inCode, ast }, i) => {
    const viewName = `orchidTmpView${id++}ForViews`;

    queries.push({
      batch: [
        `SAVEPOINT "${viewName}S"`,
        `CREATE TEMPORARY${'recursive' in ast.options && ast.options.recursive ? ' RECURSIVE' : ''} VIEW "${viewName}" (${ast.options.columns?.map((column) => `"${column}"`).join(', ')}) AS (${inCode})`,
        `SELECT ${i} i, '${viewName}' v, pg_get_viewdef('"${viewName}"') sql`,
        `DROP VIEW "${viewName}"`,
        `RELEASE SAVEPOINT "${viewName}S"`,
      ],
    });
  });

  let results;
  try {
    const sql = queries.flatMap((q) => q.batch).join(';');
    const query = () => adapter.query(sql, []);
    results = (await (adapter.isInTransaction()
      ? adapter.savepoint('orchidOrmGeneratorViews', query)
      : query())) as unknown as QueryResult[];
  } catch {
    results = (
      await Promise.all(
        queries.map(async ({ batch: queries }, i) => {
          const sql = queries.join(';');
          const query = () => adapter.query(sql, []);
          return (await (
            adapter.isInTransaction()
              ? adapter.savepoint(`orchidOrmGeneratorViews${i}`, query)
              : query()
          ).catch((err) => {
            if (typeof err === 'object') {
              const code = getDriverErrorCode(err);
              if (code === '42703' || code === '42704' || code === '42P01') {
                return [];
              }
            }

            throw err;
          })) as unknown as QueryResult[];
        }),
      )
    ).flat();
  }

  const handled = new Set<number>();
  for (const result of results) {
    for (const row of result.rows) {
      if ('sql' in row) {
        const { i, v } = row;
        const cmp = compare[i];
        const hasQuote = !!cmp.inDb.match(/\w*WITH RECURSIVE "/);
        const sql = row.sql.replaceAll(hasQuote ? v : `"${v}"`, cmp.ast.name);

        if (sql !== cmp.inDb) {
          cmp.onNotEqual();
        }
        handled.add(i);
      }
    }
  }

  compare.forEach((cmp, i) => {
    if (!handled.has(i)) {
      cmp.onNotEqual();
    }
  });
};

export const compareSqlExpressionResult = (
  resultSql: string,
  inCode: unknown[],
) => {
  let pos = 7;
  const rgx = /\s+AS\s+"\*(inDb-\d+|inCode-\d+-\d+)\*",?/g;
  let match;
  let inDb = '';
  let codeI = 0;
  const matches = inCode.map(() => true);
  while ((match = rgx.exec(resultSql))) {
    const sql = resultSql.slice(pos, rgx.lastIndex - match[0].length).trim();
    const arr = match[1].split('-');
    if (arr.length === 2) {
      inDb = sql;
      codeI = 0;
    } else {
      if (
        inDb !== sql &&
        // Comparing `(sql) = sql` and `sql = (sql)` below.
        // Could not reproduce this case in integration tests, but it was reported in #494.
        !(
          inDb.startsWith('(') &&
          inDb.endsWith(')') &&
          inDb.slice(1, -1) === sql
        ) &&
        !(sql.startsWith('(') && sql.endsWith(')') && sql.slice(1, -1) === inDb)
      ) {
        matches[codeI] = false;
      }
      codeI++;
    }
    pos = rgx.lastIndex;
  }

  const firstMatching = matches.indexOf(true);
  return firstMatching === -1 ? undefined : firstMatching;
};

export const promptCreateOrRename = (
  kind: string,
  name: string,
  drop: string[],
  verifying: boolean | undefined,
): Promise<number> => {
  if (verifying) throw new AbortSignal();

  let hintPos = name.length + 4;
  for (const from of drop) {
    const value = from.length + 8 + name.length;
    if (value > hintPos) hintPos = value;
  }

  let max = 0;
  const add = name.length + 3;
  for (const name of drop) {
    if (name.length + add > max) {
      max = name.length + add;
    }
  }

  const renameMessage = `rename ${kind}`;

  return promptSelect({
    message: `Create or rename ${colors.blueBold(
      name,
    )} ${kind} from another ${kind}?`,
    options: [
      `${colors.greenBold('+')} ${name}  ${colors.pale(
        `create ${kind}`.padStart(
          hintPos + renameMessage.length - name.length - 4,
          ' ',
        ),
      )}`,
      ...drop.map(
        (d) =>
          `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
            '=>',
          )} ${name}  ${colors.pale(
            renameMessage.padStart(
              hintPos + renameMessage.length - d.length - name.length - 8,
              ' ',
            ),
          )}`,
      ),
    ],
  });
};

export const checkForColumnAddOrDrop = (
  shape: RakeDbAst.ChangeTableShape,
  key: string,
) => {
  const item = shape[key];
  if (item) {
    return (
      item &&
      (Array.isArray(item) || item.type === 'add' || item.type === 'drop')
    );
  }

  for (const k in shape) {
    const item = shape[k];
    if (
      Array.isArray(item)
        ? item.some(
            (item) =>
              (item.type === 'add' || item.type === 'drop') &&
              item.item.data.name === key,
          )
        : (item.type === 'add' || item.type === 'drop') &&
          item.item.data.name === key
    ) {
      return true;
    }
  }

  return false;
};
