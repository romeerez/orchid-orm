import {
  dbColumnToAst,
  DbStructureDomainsMap,
  getDbTableColumnsChecks,
  instantiateDbColumn,
  StructureToAstCtx,
  StructureToAstTableData,
} from '../structureToAst';
import { ColumnType, EnumColumn, QueryWithTable } from 'pqb';
import { DbStructure, IntrospectedStructure } from '../dbStructure';
import { RakeDbAst } from 'rake-db';
import { promptCreateOrRename } from './generators.utils';
import { deepCompare, RecordUnknown } from 'orchid-core';
import { encodeColumnDefault } from '../../migration/migrationUtils';
import { getSchemaAndTableFromName } from '../../common';
import { CompareSql } from './tables.generator';

export const processColumns = async (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  dbTable: DbStructure.Table,
  codeTable: QueryWithTable,
  tableData: StructureToAstTableData,
  shape: RakeDbAst.ChangeTableShape,
  ast: RakeDbAst[],
  currentSchema: string,
  compareExpressions: CompareSql,
  pushedChangeTableRef: { current: boolean },
  changeTableAst: RakeDbAst.ChangeTable,
) => {
  const dbColumns = Object.fromEntries(
    dbTable.columns.map((column) => [column.name, column]),
  );

  const { columnsToAdd, columnsToDrop, columnsToChange } = groupColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    dbTable,
    codeTable,
    dbColumns,
    tableData,
  );

  await addOrRenameColumns(tableData, shape, columnsToAdd, columnsToDrop);
  dropColumns(shape, columnsToDrop);
  changeColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    ast,
    currentSchema,
    dbColumns,
    columnsToChange,
    compareExpressions,
    shape,
    pushedChangeTableRef,
    changeTableAst,
  );
};

type KeyAndColumn = { key: string; column: ColumnType };

const groupColumns = (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  dbTable: DbStructure.Table,
  codeTable: QueryWithTable,
  dbColumns: { [K: string]: DbStructure.Column },
  tableData: StructureToAstTableData,
): {
  columnsToAdd: KeyAndColumn[];
  columnsToDrop: KeyAndColumn[];
  columnsToChange: Map<string, ColumnType>;
} => {
  const columnsToAdd: { key: string; column: ColumnType }[] = [];
  const columnsToDrop: { key: string; column: ColumnType }[] = [];
  const columnsToChange = new Map<string, ColumnType>();

  const checks = getDbTableColumnsChecks(tableData);

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
      tableData,
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
  tableData: StructureToAstTableData,
  shape: RakeDbAst.ChangeTableShape,
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

        if (tableData.primaryKey) {
          const { columns } = tableData.primaryKey;
          for (let i = 0; i < columns.length; i++) {
            if (columns[i] === from) columns[i] = key;
          }
        }

        for (const index of tableData.indexes) {
          for (const column of index.columns) {
            if ('column' in column && column.column === from) {
              column.column = key;
            }
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
  shape: RakeDbAst.ChangeTableShape,
  columnsToDrop: KeyAndColumn[],
) => {
  for (const { key, column } of columnsToDrop) {
    shape[key] = {
      type: 'drop',
      item: column,
    };
  }
};

interface BoolRef {
  current: boolean;
}

const changeColumns = (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  dbColumns: { [K: string]: DbStructure.Column },
  columnsToChange: Map<string, ColumnType>,
  compareExpressions: CompareSql,
  shape: RakeDbAst.ChangeTableShape,
  pushedChangeTableRef: BoolRef,
  changeTableAst: RakeDbAst.ChangeTable,
) => {
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
      for (const key of [
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
      const valuesBeforeLen = compareExpressions.values.length;
      const dbDefault = encodeColumnDefault(
        dbData.default,
        compareExpressions.values,
        dbColumn,
      ) as string;
      const dbValues = compareExpressions.values.slice(valuesBeforeLen);

      const codeDefault = encodeColumnDefault(
        codeData.default,
        compareExpressions.values,
        codeColumn,
      ) as string;
      const codeValues = compareExpressions.values.slice(valuesBeforeLen);

      if (
        dbValues.length !== codeValues.length ||
        (dbValues.length &&
          JSON.stringify(dbValues) !== JSON.stringify(codeValues))
      ) {
        changed = true;
        compareExpressions.values.length = valuesBeforeLen;
      } else if (
        dbDefault !== codeDefault &&
        dbDefault !== `(${codeDefault})`
      ) {
        compareExpressions.expressions.push({
          inDb: dbDefault,
          inCode: codeDefault,
          change: () => {
            changeColumn(shape, name, dbColumn, codeColumn);
            if (!pushedChangeTableRef.current) {
              pushedChangeTableRef.current = true;
              ast.push(changeTableAst);
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
