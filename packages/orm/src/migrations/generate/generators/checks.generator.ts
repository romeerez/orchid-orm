import { ColumnDataCheckBase, TemplateLiteralArgs } from 'orchid-core';
import { ColumnType, RawSQL } from 'pqb';
import { DbStructure, RakeDbAst } from 'rake-db';
import { ChangeTableData } from './tables.generator';
import { checkForColumnAddOrDrop, CompareExpression } from './generators.utils';

interface CodeCheck extends ColumnDataCheckBase {
  column?: string;
}

export const processChecks = (
  ast: RakeDbAst[],
  changeTableData: ChangeTableData,
  compareExpressions: CompareExpression[],
): void => {
  const codeChecks = collectCodeChecks(changeTableData);
  const {
    dbTableData,
    changeTableAst: { add, shape },
  } = changeTableData;

  const hasDbChecks = dbTableData.constraints.some((c) => c.check);
  if (!hasDbChecks) {
    if (codeChecks.length) {
      const constraints = (add.constraints ??= []);
      for (const check of codeChecks) {
        if (check.column && changeTableData.changingColumns[check.column]) {
          const column = changeTableData.changingColumns[check.column];
          column.to.data.check = check;
        } else {
          constraints.push({ check: check.sql, name: check.name });
        }
      }
    }
    return;
  }

  let wait = 0;
  const foundCodeChecks = new Set<number>();
  for (const dbConstraint of dbTableData.constraints) {
    const { check: dbCheck, name } = dbConstraint;
    if (!dbCheck) continue;

    const hasChangedColumn = dbCheck.columns?.some((column) =>
      checkForColumnAddOrDrop(shape, column),
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
        handle(i) {
          if (i !== undefined) return;

          dropCheck(changeTableData, dbCheck, name);

          if (--wait === 0 && !changeTableData.pushedAst) {
            changeTableData.pushedAst = true;

            (add.constraints ??= []).push(
              ...codeChecks
                .filter((_, i) => !foundCodeChecks.has(i))
                .map((check) => ({
                  name: check.name,
                  check: check.sql,
                })),
            );

            ast.push(changeTableData.changeTableAst);
          }
        },
      });
    } else {
      dropCheck(changeTableData, dbCheck, name);
    }
  }
};

const collectCodeChecks = ({
  codeTable,
  changeTableAst: { shape },
}: ChangeTableData): CodeCheck[] => {
  const codeChecks: CodeCheck[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.check) continue;

    const name = column.data.name ?? key;
    if (checkForColumnAddOrDrop(shape, name)) continue;

    codeChecks.push({
      ...column.data.check,
      column: name,
    });
  }

  if (codeTable.internal.tableData.constraints) {
    for (const constraint of codeTable.internal.tableData.constraints) {
      const { check } = constraint;
      if (check) {
        codeChecks.push({ sql: check, name: constraint.name });
      }
    }
  }

  return codeChecks;
};

const dropCheck = (
  { changeTableAst: { drop }, changingColumns }: ChangeTableData,
  dbCheck: DbStructure.Check,
  name: string,
) => {
  const constraints = (drop.constraints ??= []);
  const sql = new RawSQL([
    [dbCheck.expression],
  ] as unknown as TemplateLiteralArgs);

  if (dbCheck.columns?.length === 1 && changingColumns[dbCheck.columns[0]]) {
    const column = changingColumns[dbCheck.columns[0]];
    column.from.data.name = 'i_d';
    column.from.data.check = {
      name,
      sql,
    };
  } else {
    constraints.push({
      name,
      check: sql,
    });
  }
};
