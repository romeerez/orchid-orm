import { promptSelect } from '../../prompt';
import { colors } from '../../colors';
import { RawSQLBase } from 'orchid-core';
import { Adapter } from 'pqb';

export interface CompareExpression {
  compare: {
    inDb: string;
    inCode: (string | RawSQLBase)[];
  }[];

  handle(index?: number): void;
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
        try {
          const sql = `CREATE TEMPORARY VIEW ${viewName} AS (SELECT ${compare
            .map(
              ({ inDb, inCode }, i) =>
                `${inDb} AS "*inDb-${i}*", ${inCode
                  .map(
                    (s, j) =>
                      `(${
                        typeof s === 'string' ? s : s.toSQL({ values })
                      }) "*inCode-${i}-${j}*"`,
                  )
                  .join(', ')}`,
            )
            .join(', ')} FROM ${source})`;
          await adapter.query({ text: sql, values });
        } catch (err) {
          handle();
          return;
        }

        const {
          rows: [{ v }],
        } = await adapter.query<{ v: string }>(
          `SELECT pg_get_viewdef('${viewName}') v`,
        );

        await adapter.query(`DROP VIEW ${viewName}`);

        let pos = 7;
        const rgx = /\s+AS\s+"\*(inDb-\d+|inCode-\d+-\d+)\*",?/g;
        let match;
        let inDb = '';
        let codeI = 0;
        const matches = compare[0].inCode.map(() => true);
        while ((match = rgx.exec(v))) {
          const sql = v.slice(pos, rgx.lastIndex - match[0].length).trim();
          const arr = match[1].split('-');
          if (arr.length === 2) {
            inDb = sql;
            codeI = 0;
          } else {
            if (inDb !== sql) {
              matches[codeI] = false;
            }
            codeI++;
          }
          pos = rgx.lastIndex;
        }

        const firstMatching = matches.indexOf(true);
        handle(firstMatching === -1 ? undefined : firstMatching);
      }),
    );
  }
};

export const promptCreateOrRename = (
  kind: string,
  name: string,
  drop: string[],
): Promise<number> => {
  let max = 0;
  const add = name.length + 3;
  for (const name of drop) {
    if (name.length + add > max) {
      max = name.length + add;
    }
  }

  const renameMessage = `rename ${name}`;

  return promptSelect({
    message: `Create or rename ${colors.blueBold(
      name,
    )} ${kind} from another ${kind}?`,
    options: [
      `${colors.greenBold('+')} ${name} ${colors
        .pale('create name')
        .padStart(max + renameMessage.length - name.length, ' ')}`,
      ...drop.map(
        (d) =>
          `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
            '>',
          )} ${name} ${colors
            .pale(renameMessage)
            .padStart(max + renameMessage.length - d.length - add, ' ')}`,
      ),
    ],
  });
};
