import {
  RakeDbAst,
  DbStructure,
  concatSchemaAndName,
  getSchemaAndTableFromName,
  getConstraintName,
  AnyRakeDbConfig,
} from 'rake-db';
import { ColumnType, TableData } from 'pqb';
import { ChangeTableData, TableShapes } from './tables.generator';
import { deepCompare, toSnakeCase } from 'orchid-core';
import { checkForColumnAddOrDrop } from './generators.utils';

interface Constraint extends TableData.Constraint {
  references: TableData.References;
}

interface CodeForeignKey {
  references: DbStructure.References;
  codeConstraint: Constraint;
}

interface ReferencesWithStringTable extends TableData.References {
  fnOrTable: string;
}

const mapMatchToDb: {
  [K in TableData.References.Match]: DbStructure.ForeignKeyMatch;
} = {
  FULL: 'f',
  PARTIAL: 'p',
  SIMPLE: 's',
};

const mapMatchToCode = {} as {
  [K in DbStructure.ForeignKeyMatch]: TableData.References.Match;
};
for (const key in mapMatchToDb) {
  mapMatchToCode[
    mapMatchToDb[
      key as TableData.References.Match
    ] as DbStructure.ForeignKeyMatch
  ] = key as TableData.References.Match;
}

const mapActionToDb: {
  [K in TableData.References.Action]: DbStructure.ForeignKeyAction;
} = {
  'NO ACTION': 'a',
  RESTRICT: 'r',
  CASCADE: 'c',
  'SET NULL': 'n',
  'SET DEFAULT': 'd',
};

const mapActionToCode = {} as {
  [K in DbStructure.ForeignKeyAction]: TableData.References.Action;
};
for (const key in mapActionToDb) {
  mapActionToCode[
    mapActionToDb[
      key as TableData.References.Action
    ] as DbStructure.ForeignKeyAction
  ] = key as TableData.References.Action;
}

export const processForeignKeys = (
  config: AnyRakeDbConfig,
  ast: RakeDbAst[],
  changeTables: ChangeTableData[],
  currentSchema: string,
  tableShapes: TableShapes,
): void => {
  for (const changeTableData of changeTables) {
    const codeForeignKeys = collectCodeFkeys(
      config,
      changeTableData,
      currentSchema,
    );

    const { codeTable, dbTableData, changeTableAst, schema, changingColumns } =
      changeTableData;
    const { shape, add, drop } = changeTableAst;
    let changed = false;

    for (const dbConstraint of dbTableData.constraints) {
      const { references: dbReferences } = dbConstraint;
      if (!dbReferences) continue;

      const hasChangedColumn = dbReferences.columns.some((column) =>
        checkForColumnAddOrDrop(shape, column),
      );
      if (hasChangedColumn) continue;

      const foreignShape =
        tableShapes[
          `${dbReferences.foreignSchema}.${dbReferences.foreignTable}`
        ];
      const hasForeignChangedColumn =
        foreignShape &&
        dbReferences.foreignColumns.some((column) => {
          const res = checkForColumnAddOrDrop(foreignShape, column);
          // console.log(res, column);
          return res;
        });
      if (hasForeignChangedColumn) continue;

      let found = false;
      let rename: string | undefined;
      for (let i = 0; i < codeForeignKeys.length; i++) {
        const codeForeignKey = codeForeignKeys[i];
        const codeReferences = codeForeignKey.references;
        if (deepCompare(dbReferences, codeReferences)) {
          found = true;
          codeForeignKeys.splice(i, 1);

          const codeName =
            codeForeignKey.codeConstraint.name ??
            getConstraintName(
              codeTable.table,
              codeForeignKey,
              config.snakeCase,
            );
          if (codeName !== dbConstraint.name) {
            rename = codeName;
          }
        }
      }

      if (!found) {
        const foreignKey = dbForeignKeyToCodeForeignKey(
          config,
          dbConstraint,
          dbReferences,
        );

        if (
          dbReferences.columns.length === 1 &&
          changingColumns[dbReferences.columns[0]]
        ) {
          const column = changingColumns[dbReferences.columns[0]];
          (column.from.data.foreignKeys ??= []).push({
            fnOrTable: foreignKey.references.fnOrTable,
            foreignColumns: foreignKey.references.foreignColumns,
            options: foreignKey.references.options,
          });
        } else {
          (drop.constraints ??= []).push(foreignKey);
        }

        changed = true;
      } else if (rename) {
        ast.push({
          type: 'renameTableItem',
          kind: 'CONSTRAINT',
          tableSchema: schema,
          tableName: codeTable.table,
          from: dbConstraint.name,
          to: rename,
        });
      }
    }

    if (codeForeignKeys.length) {
      const constraints = (add.constraints ??= []);
      for (const { codeConstraint, references } of codeForeignKeys) {
        if (
          references.columns.length === 1 &&
          changingColumns[references.columns[0]]
        ) {
          const column = changingColumns[references.columns[0]];
          (column.to.data.foreignKeys ??= []).push({
            fnOrTable: references.foreignTable,
            foreignColumns: codeConstraint.references.foreignColumns,
            options: codeConstraint.references.options,
          });
        } else {
          constraints.push(codeConstraint);
        }
      }

      changed = true;
    }

    if (changed && !changeTableData.pushedAst) {
      changeTableData.pushedAst = true;
      ast.push(changeTableData.changeTableAst);
    }
  }
};

const collectCodeFkeys = (
  config: AnyRakeDbConfig,
  { codeTable, changeTableAst: { shape } }: ChangeTableData,
  currentSchema: string,
): CodeForeignKey[] => {
  const codeForeignKeys: CodeForeignKey[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.foreignKeys) continue;

    const name = column.data.name ?? key;
    if (checkForColumnAddOrDrop(shape, name)) continue;

    codeForeignKeys.push(
      ...column.data.foreignKeys.map((x) => {
        const columns = [name];

        const fnOrTable = fnOrTableToString(x.fnOrTable);

        return parseForeignKey(
          config,
          {
            name: x.options?.name,
            references: {
              columns: [name],
              fnOrTable,
              foreignColumns: x.foreignColumns,
              options: x.options,
            },
          },
          {
            columns,
            fnOrTable,
            foreignColumns: x.foreignColumns,
            options: x.options,
          },
          currentSchema,
        );
      }),
    );
  }

  if (codeTable.internal.tableData.constraints) {
    for (const tableConstraint of codeTable.internal.tableData.constraints) {
      const { references: refs } = tableConstraint;
      if (!refs) continue;

      const fnOrTable = fnOrTableToString(refs.fnOrTable);

      codeForeignKeys.push(
        parseForeignKey(
          config,
          {
            ...tableConstraint,
            references: {
              ...refs,
              fnOrTable,
            },
          },
          {
            ...refs,
            fnOrTable,
            columns: config.snakeCase
              ? refs.columns.map(toSnakeCase)
              : refs.columns,
            foreignColumns: config.snakeCase
              ? refs.foreignColumns.map(toSnakeCase)
              : refs.foreignColumns,
          },
          currentSchema,
        ),
      );
    }
  }

  return codeForeignKeys;
};

export const fnOrTableToString = (
  fnOrTable: TableData.References['fnOrTable'],
) => {
  if (typeof fnOrTable !== 'string') {
    const { schema, table } = new (fnOrTable())();
    fnOrTable = concatSchemaAndName({ schema, name: table });
  }
  return fnOrTable;
};

const parseForeignKey = (
  config: AnyRakeDbConfig,
  codeConstraint: Constraint,
  references: ReferencesWithStringTable,
  currentSchema: string,
): CodeForeignKey => {
  const { fnOrTable, columns, foreignColumns, options } = references;
  const [schema, table] = getSchemaAndTableFromName(fnOrTable);

  return {
    references: {
      foreignSchema: schema ?? currentSchema,
      foreignTable: table,
      columns,
      foreignColumns: config.snakeCase
        ? foreignColumns.map(toSnakeCase)
        : foreignColumns,
      match: mapMatchToDb[options?.match || 'SIMPLE'],
      onUpdate: mapActionToDb[options?.onUpdate || 'NO ACTION'],
      onDelete: mapActionToDb[options?.onDelete || 'NO ACTION'],
    },
    codeConstraint,
  };
};

const dbForeignKeyToCodeForeignKey = (
  config: AnyRakeDbConfig,
  dbConstraint: DbStructure.Constraint,
  dbReferences: DbStructure.References,
): { name?: string; references: TableData.References } => ({
  name:
    dbConstraint.name ===
    getConstraintName(
      dbConstraint.tableName,
      { references: dbReferences },
      config.snakeCase,
    )
      ? undefined
      : dbConstraint.name,
  references: {
    columns: dbReferences.columns,
    fnOrTable: `${dbReferences.foreignSchema}.${dbReferences.foreignTable}`,
    foreignColumns: dbReferences.foreignColumns,
    options: {
      match:
        dbReferences.match === 's'
          ? undefined
          : mapMatchToCode[dbReferences.match],
      onUpdate:
        dbReferences.onUpdate === 'a'
          ? undefined
          : mapActionToCode[dbReferences.onUpdate],
      onDelete:
        dbReferences.onDelete === 'a'
          ? undefined
          : mapActionToCode[dbReferences.onDelete],
    },
  },
});
