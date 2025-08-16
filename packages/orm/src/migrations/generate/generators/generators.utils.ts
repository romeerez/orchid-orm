import { RakeDbAst, promptSelect } from 'rake-db';
import { RawSQLBase, colors } from 'orchid-core';
import { Adapter, QueryResult } from 'pqb';
import { AbortSignal } from '../generate';

export interface CompareExpression {
  compare: {
    inDb: string;
    inCode: (string | RawSQLBase)[];
  }[];

  handle(i?: number): void;
}

export interface TableExpression extends CompareExpression {
  source: string;
}

export const compareSqlExpressions = async (
  tableExpressions: TableExpression[],
  adapter: Adapter,
) => {
  if (tableExpressions.length) {
    let id = 1;
    await Promise.all(
      tableExpressions.map(async ({ source, compare, handle }) => {
        const viewName = `orchidTmpView${id++}`;
        const values: unknown[] = [];
        let result: QueryResult | undefined;
        try {
          const results = (await adapter.query({
            // It is important to run `CREATE TEMPORARY VIEW` and `DROP VIEW` on the same db connection,
            // that's why SQLs are combined into a single query.
            text: [
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
                .join(', ')} FROM ${source})`,
              `SELECT pg_get_viewdef('${viewName}') v`,
              `DROP VIEW ${viewName}`,
            ].join('; '),
            values,
          })) as unknown as QueryResult[];
          result = results[1];
        } catch {}

        if (!result) {
          handle();
          return;
        }

        const match = compareSqlExpressionResult(
          result.rows[0].v,
          compare[0].inCode,
        );
        handle(match);
      }),
    );
  }
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
