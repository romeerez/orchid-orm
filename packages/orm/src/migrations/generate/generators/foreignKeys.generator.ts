import {
  RakeDbAst,
  DbStructure,
  concatSchemaAndName,
  getSchemaAndTableFromName,
  getConstraintName,
} from 'rake-db';
import { ColumnType, ForeignKeyAction, ForeignKeyMatch, TableData } from 'pqb';
import { ChangeTableData, TableShapes } from './tables.generator';
import { deepCompare } from 'orchid-core';
import { checkForColumnChange } from './generators.utils';

interface CodeForeignKey {
  references: DbStructure.References;
  codeConstraint: TableData.Constraint;
}

interface ReferencesWithStringTable extends TableData.References {
  fnOrTable: string;
}

const mapMatchToDb: { [K in ForeignKeyMatch]: DbStructure.ForeignKeyMatch } = {
  FULL: 'f',
  PARTIAL: 'p',
  SIMPLE: 's',
};

const mapMatchToCode = {} as {
  [K in DbStructure.ForeignKeyMatch]: ForeignKeyMatch;
};
for (const key in mapMatchToDb) {
  mapMatchToCode[
    mapMatchToDb[key as ForeignKeyMatch] as DbStructure.ForeignKeyMatch
  ] = key as ForeignKeyMatch;
}

const mapActionToDb: { [K in ForeignKeyAction]: DbStructure.ForeignKeyAction } =
  {
    'NO ACTION': 'a',
    RESTRICT: 'r',
    CASCADE: 'c',
    'SET NULL': 'n',
    'SET DEFAULT': 'd',
  };

const mapActionToCode = {} as {
  [K in DbStructure.ForeignKeyAction]: ForeignKeyAction;
};
for (const key in mapActionToDb) {
  mapActionToCode[
    mapActionToDb[key as ForeignKeyAction] as DbStructure.ForeignKeyAction
  ] = key as ForeignKeyAction;
}

export const processForeignKeys = (
  ast: RakeDbAst[],
  changeTables: ChangeTableData[],
  currentSchema: string,
  tableShapes: TableShapes,
): void => {
  for (const changeTableData of changeTables) {
    const codeForeignKeys = collectCodeFkeys(changeTableData, currentSchema);

    const { codeTable, dbTableData, changeTableAst, schema } = changeTableData;
    const { shape, add, drop } = changeTableAst;
    let changed = false;

    for (const dbConstraint of dbTableData.constraints) {
      const { references: dbReferences } = dbConstraint;
      if (!dbReferences) continue;

      const hasChangedColumn = dbReferences.columns.some((column) =>
        checkForColumnChange(shape, column),
      );
      if (hasChangedColumn) continue;

      const foreignShape =
        tableShapes[
          `${dbReferences.foreignSchema}.${dbReferences.foreignTable}`
        ];
      const hasForeignChangedColumn =
        foreignShape &&
        dbReferences.foreignColumns.some((column) =>
          checkForColumnChange(foreignShape, column),
        );
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
            getConstraintName(codeTable.table, codeForeignKey);
          if (codeName !== dbConstraint.name) {
            rename = codeName;
          }
        }
      }

      if (!found) {
        (drop.constraints ??= []).push(
          dbForeignKeyToCodeForeignKey(dbConstraint, dbReferences),
        );
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
      (add.constraints ??= []).push(
        ...codeForeignKeys.map((x) => x.codeConstraint),
      );
      changed = true;
    }

    if (changed && !changeTableData.pushedAst) {
      changeTableData.pushedAst = true;
      ast.push(changeTableData.changeTableAst);
    }
  }
};

const collectCodeFkeys = (
  { codeTable, changeTableAst: { shape } }: ChangeTableData,
  currentSchema: string,
): CodeForeignKey[] => {
  const codeForeignKeys: CodeForeignKey[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.foreignKeys) continue;

    const name = column.data.name ?? key;
    if (checkForColumnChange(shape, name)) continue;

    codeForeignKeys.push(
      ...column.data.foreignKeys.map((x) => {
        const columns = [name];

        const references: ReferencesWithStringTable = {
          columns,
          fnOrTable: fnOrTableToString('fn' in x ? x.fn : x.table),
          foreignColumns: x.columns,
          options: {
            name: x.name,
            match: x.match,
            onUpdate: x.onUpdate,
            onDelete: x.onDelete,
          },
        };

        return parseForeignKey(
          {
            name: x.name,
            references,
          },
          references,
          currentSchema,
        );
      }),
    );
  }

  if (codeTable.internal.constraints) {
    for (const constraint of codeTable.internal.constraints) {
      const { references } = constraint;
      if (!references) continue;

      references.fnOrTable = fnOrTableToString(references.fnOrTable);

      codeForeignKeys.push(
        parseForeignKey(
          constraint,
          references as ReferencesWithStringTable,
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
  codeConstraint: TableData.Constraint,
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
      foreignColumns,
      match: mapMatchToDb[options?.match || 'SIMPLE'],
      onUpdate: mapActionToDb[options?.onUpdate || 'NO ACTION'],
      onDelete: mapActionToDb[options?.onDelete || 'NO ACTION'],
    },
    codeConstraint,
  };
};

const dbForeignKeyToCodeForeignKey = (
  dbConstraint: DbStructure.Constraint,
  dbReferences: DbStructure.References,
): TableData.Constraint => ({
  name:
    dbConstraint.name ===
    getConstraintName(dbConstraint.tableName, { references: dbReferences })
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
