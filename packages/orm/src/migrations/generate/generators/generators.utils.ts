import { RakeDbAst, promptSelect } from 'rake-db';
import { RawSQLBase, colors, QueryResult, AdapterBase } from 'pqb';
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
  adapter: AdapterBase,
) => {
  if (!tableExpressions.length) return;

  let id = 1;
  for (const { source, compare, handle } of tableExpressions) {
    const viewName = `orchidTmpView${id++}`;
    const values: unknown[] = [];

    // It is important to run `CREATE TEMPORARY VIEW` and `DROP VIEW` on the same db connection,
    // that's why SQLs are combined into a single query.
    const combinedQueries = [
      `SAVEPOINT "${viewName}"`,
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
      `RELEASE SAVEPOINT "${viewName}"`,
    ].join('; ');

    const result = await adapter.query(combinedQueries, values).then(
      (res) => {
        const results = res as unknown as QueryResult[];
        // postgres-js ignores non-returning queries and has length 2,
        // node-postgres gives a result for every query.
        return results.length === 2 ? results[1] : results[2];
      },
      async (err) => {
        await adapter.query(`ROLLBACK TO SAVEPOINT "${viewName}"`);

        // ignore the "type ... does not exist" because the type may be added in the same migration,
        // but throw on other errors
        if (err.code !== '42704') {
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
