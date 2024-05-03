import { ChangeTableData } from './tables.generator';
import { ColumnType, RawSQL, TableData } from 'pqb';
import { ColumnDataCheckBase, TemplateLiteralArgs } from 'orchid-core';
import { DbStructure } from '../../dbStructure';
import { RakeDbAst } from 'rake-db';
import { checkForColumnChange, CompareExpression } from './generators.utils';

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
      (add.constraints ??= []).push(
        ...codeChecks.map((check) => ({
          name: check.options?.name,
          check: check.sql,
        })),
      );
    }
    return;
  }

  let wait = 0;
  const foundCodeChecks = new Set<number>();
  for (const dbConstraint of dbTableData.constraints) {
    const { check: dbCheck, name } = dbConstraint;
    if (!dbCheck) continue;

    const hasChangedColumn = dbCheck.columns?.some((column) =>
      checkForColumnChange(shape, column),
    );
    if (hasChangedColumn) continue;

    if (codeChecks.length) {
      wait++;
      compareExpressions.push({
        compare: [
          {
            inDb: dbCheck.expression,
            inCode: codeChecks.map((check) => check.sql),
          },
        ],
        handle(index) {
          if (index !== undefined) return;

          dropCheck(drop, dbCheck, name);

          if (--wait === 0 && !changeTableData.pushedAst) {
            changeTableData.pushedAst = true;

            (add.constraints ??= []).push(
              ...codeChecks
                .filter((_, i) => !foundCodeChecks.has(i))
                .map((check) => ({
                  name: check.options?.name,
                  check: check.sql,
                })),
            );

            ast.push(changeTableData.changeTableAst);
          }
        },
      });
    } else {
      dropCheck(drop, dbCheck, name);
    }
  }
};

const collectCodeChecks = ({
  codeTable,
  changeTableAst: { shape },
}: ChangeTableData): ColumnDataCheckBase[] => {
  const codeChecks: ColumnDataCheckBase[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.check) continue;

    const name = column.data.name ?? key;
    if (checkForColumnChange(shape, name)) continue;

    codeChecks.push(column.data.check);
  }

  if (codeTable.internal.constraints) {
    for (const constraint of codeTable.internal.constraints) {
      const { check } = constraint;
      if (check) {
        codeChecks.push({ sql: check, options: { name: constraint.name } });
      }
    }
  }

  return codeChecks;
};

const dropCheck = (
  drop: TableData,
  dbCheck: DbStructure.Check,
  name: string,
) => {
  (drop.constraints ??= []).push({
    name,
    check: new RawSQL([[dbCheck.expression]] as unknown as TemplateLiteralArgs),
  });
};
