import {
  dbColumnToAst,
  DbStructureDomainsMap,
  getDbTableColumnsChecks,
  instantiateDbColumn,
  StructureToAstCtx,
} from '../structureToAst';
import { ColumnType, EnumColumn } from 'pqb';
import { DbStructure, IntrospectedStructure } from '../dbStructure';
import { RakeDbAst } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';
import { deepCompare, RecordUnknown } from 'orchid-core';
import { encodeColumnDefault } from '../../migration/migrationUtils';
import { getSchemaAndTableFromName } from '../../common';
import { ChangeTableData, CompareSql } from './tables.generator';

export const processColumns = async (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  changeTableData: ChangeTableData,
  ast: RakeDbAst[],
  currentSchema: string,
  compareSql: CompareSql,
) => {
  const { dbTable } = changeTableData;
  const dbColumns = Object.fromEntries(
    dbTable.columns.map((column) => [column.name, column]),
  );

  const { columnsToAdd, columnsToDrop, columnsToChange } = groupColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    dbColumns,
    changeTableData,
  );

  await addOrRenameColumns(
    dbStructure,
    changeTableData,
    columnsToAdd,
    columnsToDrop,
  );
  dropColumns(changeTableData, columnsToDrop);
  changeColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    ast,
    currentSchema,
    dbColumns,
    columnsToChange,
    compareSql,
    changeTableData,
  );
};

type KeyAndColumn = { key: string; column: ColumnType };

const groupColumns = (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  dbColumns: { [K: string]: DbStructure.Column },
  changeTableData: ChangeTableData,
): {
  columnsToAdd: KeyAndColumn[];
  columnsToDrop: KeyAndColumn[];
  columnsToChange: Map<string, ColumnType>;
} => {
  const columnsToAdd: { key: string; column: ColumnType }[] = [];
  const columnsToDrop: { key: string; column: ColumnType }[] = [];
  const columnsToChange = new Map<string, ColumnType>();

  const { codeTable, dbTable, dbTableData } = changeTableData;
  const checks = getDbTableColumnsChecks(changeTableData.dbTableData);

  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    const name = column.data.name ?? key;
    if (dbColumns[name]) {
      columnsToChange.set(name, column);
    } else {
      columnsToAdd.push({ key: name, column });
    }
  }

  for (const name in dbColumns) {
    if (columnsToChange.has(name)) continue;

    const [key, column] = dbColumnToAst(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      dbTable.name,
      dbColumns[name],
      dbTable,
      dbTableData,
      checks,
    );

    columnsToDrop.push({ key, column });
  }

  return {
    columnsToAdd,
    columnsToDrop,
    columnsToChange,
  };
};

const addOrRenameColumns = async (
  dbStructure: IntrospectedStructure,
  {
    dbTableData,
    schema,
    changeTableAst: { name: tableName, shape },
  }: ChangeTableData,
  columnsToAdd: KeyAndColumn[],
  columnsToDrop: KeyAndColumn[],
) => {
  for (const { key, column } of columnsToAdd) {
    if (columnsToDrop.length) {
      const index = await promptCreateOrRename(
        'column',
        column.data.name ?? key,
        columnsToDrop.map((x) => x.key),
      );
      if (index) {
        const drop = columnsToDrop[index - 1];
        columnsToDrop.splice(index - 1, 1);

        const from = drop.key;
        shape[from] = {
          type: 'rename',
          name: key,
        };

        if (dbTableData.primaryKey) {
          renameColumn(dbTableData.primaryKey.columns, from, key);
        }

        for (const index of dbTableData.indexes) {
          for (const column of index.columns) {
            if ('column' in column && column.column === from) {
              column.column = key;
            }
          }
        }

        for (const c of dbTableData.constraints) {
          if (c.check?.columns) {
            renameColumn(c.check.columns, from, key);
          }
          if (c.references) {
            renameColumn(c.references.columns, from, key);
          }
        }

        for (const c of dbStructure.constraints) {
          if (
            c.references &&
            c.references.foreignSchema === schema &&
            c.references.foreignTable === tableName
          ) {
            renameColumn(c.references.foreignColumns, from, key);
          }
        }

        continue;
      }
    }

    shape[key] = {
      type: 'add',
      item: column,
    };
  }
};

const dropColumns = (
  { changeTableAst: { shape } }: ChangeTableData,
  columnsToDrop: KeyAndColumn[],
) => {
  for (const { key, column } of columnsToDrop) {
    shape[key] = {
      type: 'drop',
      item: column,
    };
  }
};

const changeColumns = (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  dbColumns: { [K: string]: DbStructure.Column },
  columnsToChange: Map<string, ColumnType>,
  compareSql: CompareSql,
  changeTableData: ChangeTableData,
) => {
  const { shape } = changeTableData.changeTableAst;

  for (const [name, codeColumn] of columnsToChange) {
    const dbColumnStructure = dbColumns[name];

    let changed = false;

    const dbColumn = instantiateDbColumn(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      dbColumnStructure,
    );

    const dbType = getColumnDbType(dbColumn, currentSchema);
    const codeType = getColumnDbType(codeColumn, currentSchema);
    if (dbType !== codeType) {
      changed = true;
    }

    const dbData = dbColumn.data as unknown as RecordUnknown;
    const codeData = codeColumn.data as unknown as RecordUnknown;

    if (!changed) {
      if (!dbData.isNullable) dbData.isNullable = undefined;

      for (const key of [
        'isNullable',
        'maxChars',
        'collation',
        'compression',
        'numericPrecision',
        'numericScale',
        'dateTimePrecision',
        'comment',
      ]) {
        if (dbData[key] !== codeData[key]) {
          changed = true;
          break;
        }
      }
    }

    if (
      !changed &&
      !deepCompare(
        dbData.identity,
        codeData.identity
          ? {
              always: false,
              start: 1,
              increment: 1,
              cache: 1,
              cycle: false,
              ...(codeData.identity ?? {}),
            }
          : undefined,
      )
    ) {
      changed = true;
    }

    if (
      !changed &&
      dbData.default !== undefined &&
      dbData.default !== null &&
      codeData.default !== undefined &&
      codeData.default !== null
    ) {
      const valuesBeforeLen = compareSql.values.length;
      const dbDefault = encodeColumnDefault(
        dbData.default,
        compareSql.values,
        dbColumn,
      ) as string;
      const dbValues = compareSql.values.slice(valuesBeforeLen);

      const codeDefault = encodeColumnDefault(
        codeData.default,
        compareSql.values,
        codeColumn,
      ) as string;
      const codeValues = compareSql.values.slice(valuesBeforeLen);

      if (
        dbValues.length !== codeValues.length ||
        (dbValues.length &&
          JSON.stringify(dbValues) !== JSON.stringify(codeValues))
      ) {
        changed = true;
        compareSql.values.length = valuesBeforeLen;
      } else if (
        dbDefault !== codeDefault &&
        dbDefault !== `(${codeDefault})`
      ) {
        compareSql.expressions.push({
          inDb: dbDefault,
          inCode: codeDefault,
          change: () => {
            changeColumn(shape, name, dbColumn, codeColumn);
            if (!changeTableData.pushedAst) {
              changeTableData.pushedAst = true;
              ast.push(changeTableData.changeTableAst);
            }
          },
        });
      }
    }

    if (changed) changeColumn(shape, name, dbColumn, codeColumn);
  }
};

const changeColumn = (
  shape: RakeDbAst.ChangeTableShape,
  name: string,
  dbColumn: ColumnType,
  codeColumn: ColumnType,
) => {
  codeColumn.data.as = undefined;

  shape[name] = {
    type: 'change',
    from: { column: dbColumn },
    to: { column: codeColumn },
  };
};

export const getColumnDbType = (column: ColumnType, currentSchema: string) => {
  if (column instanceof EnumColumn) {
    const [schema = currentSchema, name] = getSchemaAndTableFromName(
      column.enumName,
    );
    return (column.enumName = `${schema}.${name}`);
  } else {
    return column.dataType;
  }
};

const renameColumn = (columns: string[], from: string, to: string) => {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i] === from) {
      columns[i] = to;
    }
  }
};
