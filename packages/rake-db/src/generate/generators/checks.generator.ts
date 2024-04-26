import { ChangeTableData } from './tables.generator';
import { ColumnType, RawSQL, TableData } from 'pqb';
import { RawSQLBase, TemplateLiteralArgs } from 'orchid-core';
import { DbStructure } from '../dbStructure';
import { RakeDbAst } from 'rake-db';
import { CompareExpression } from './generators.utils';

export const processChecks = (
  ast: RakeDbAst[],
  changeTableData: ChangeTableData,
  compareExpressions: CompareExpression[],
): void => {
  const codeChecks = collectCodeChecks(changeTableData);
  const {
    dbTableData,
    changeTableAst: { add, drop, shape },
  } = changeTableData;

  const hasDbChecks = dbTableData.constraints.some((c) => c.check);
  if (!hasDbChecks) {
    if (codeChecks.length) {
      (add.constraints ??= []).push(...codeChecks.map((check) => ({ check })));
    }
    return;
  }

  let wait = 0;
  const foundCodeChecks = new Set<number>();
  for (const dbConstraint of dbTableData.constraints) {
    const { check: dbCheck } = dbConstraint;
    if (!dbCheck) continue;

    const hasChangedColumn = dbCheck.columns?.some(
      (column) => shape[column] && shape[column].type !== 'rename',
    );
    if (hasChangedColumn) continue;

    if (codeChecks.length) {
      wait++;
      compareExpressions.push({
        compare: [
          {
            inDb: dbCheck.expression,
            inCode: codeChecks,
          },
        ],
        handle(index) {
          if (index !== undefined) return;

          dropCheck(drop, dbCheck);

          if (--wait === 0 && !changeTableData.pushedAst) {
            changeTableData.pushedAst = true;

            (add.constraints ??= []).push(
              ...codeChecks
                .filter((_, i) => !foundCodeChecks.has(i))
                .map((check) => ({ check })),
            );

            ast.push(changeTableData.changeTableAst);
          }
        },
      });
    } else {
      dropCheck(drop, dbCheck);
    }
  }
};

const collectCodeChecks = ({
  codeTable,
  changeTableAst: { shape },
}: ChangeTableData): RawSQLBase[] => {
  const codeChecks: RawSQLBase[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.check) continue;

    const name = column.data.name ?? key;
    if (shape[name] && shape[name].type !== 'rename') continue;

    codeChecks.push(column.data.check);
  }

  if (codeTable.internal.constraints) {
    for (const constraint of codeTable.internal.constraints) {
      const { check } = constraint;
      if (check) {
        codeChecks.push(check);
      }
    }
  }

  return codeChecks;
};

const dropCheck = (drop: TableData, dbCheck: DbStructure.Check) => {
  (drop.constraints ??= []).push({
    check: new RawSQL([[dbCheck.expression]] as unknown as TemplateLiteralArgs),
  });
};
