import { ColumnDataCheckBase, TemplateLiteralArgs } from 'orchid-core';
import { ColumnType, RawSQL, TableData } from 'pqb';
import { DbStructure, RakeDbAst } from 'rake-db';
import { ChangeTableData } from './tables.generator';
import { checkForColumnAddOrDrop, CompareExpression } from './generators.utils';

interface CodeCheck {
  check: ColumnDataCheckBase;
  name: string;
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
      for (const codeCheck of codeChecks) {
        if (
          !codeCheck.column ||
          !changeTableData.changingColumns[codeCheck.column]
        ) {
          constraints.push({
            check: codeCheck.check.sql,
            name: codeCheck.name,
          });
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
            inCode: codeChecks.map(({ check }) => check.sql),
          },
        ],
        handle(i) {
          if (i !== undefined) {
            foundCodeChecks.add(i);
          } else {
            dropCheck(changeTableData, dbCheck, name);
          }

          if (--wait !== 0) return;

          const checksToAdd: TableData.Constraint[] = [];

          codeChecks.forEach((check, i) => {
            if (foundCodeChecks.has(i)) {
              if (!check.column) return;

              const change = changeTableData.changingColumns[check.column];
              if (!change) return;

              const columnChecks = change.to.data.checks;
              if (!columnChecks) return;

              const i = columnChecks.indexOf(check.check);
              if (i !== -1) {
                columnChecks.splice(i, 1);
              }
              return;
            }

            checksToAdd.push({
              name: check.name,
              check: check.check.sql,
            });
          });

          if (checksToAdd.length) {
            (add.constraints ??= []).push(...checksToAdd);
          }

          if (
            !changeTableData.pushedAst &&
            (changeTableData.changeTableAst.drop.constraints?.length ||
              add.constraints?.length)
          ) {
            changeTableData.pushedAst = true;
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
  const names = new Set<string>();

  const codeChecks: CodeCheck[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.checks) continue;

    const columnName = column.data.name ?? key;
    if (checkForColumnAddOrDrop(shape, columnName)) continue;

    const baseName = `${codeTable.table}_${columnName}_check`;

    codeChecks.push(
      ...column.data.checks.map((check) => {
        let name = check.name;
        if (!name) {
          name = baseName;
          let n = 0;
          while (names.has(name)) {
            name = baseName + ++n;
          }
        }
        names.add(name);

        return {
          check,
          name,
          column: columnName,
        };
      }),
    );
  }

  if (codeTable.internal.tableData.constraints) {
    for (const constraint of codeTable.internal.tableData.constraints) {
      const { check } = constraint;
      if (check) {
        const baseName = `${codeTable.table}_check`;
        let name = constraint.name;
        if (!name) {
          name = baseName;
          let n = 0;
          while (names.has(name)) {
            name = baseName + ++n;
          }
        }
        names.add(name);

        codeChecks.push({
          check: { sql: check, name: constraint.name },
          name,
        });
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
  const sql = new RawSQL([
    [dbCheck.expression],
  ] as unknown as TemplateLiteralArgs);

  if (dbCheck.columns?.length === 1 && changingColumns[dbCheck.columns[0]]) {
    const column = changingColumns[dbCheck.columns[0]];
    column.from.data.name = 'i_d';
    (column.from.data.checks ??= []).push({
      name,
      sql,
    });
  } else {
    (drop.constraints ??= []).push({
      name,
      check: sql,
    });
  }
};
