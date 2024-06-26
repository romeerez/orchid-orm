import {
  RakeDbAst,
  dbColumnToAst,
  DbStructureDomainsMap,
  getDbTableColumnsChecks,
  instantiateDbColumn,
  StructureToAstCtx,
  DbStructure,
  IntrospectedStructure,
  encodeColumnDefault,
  concatSchemaAndName,
  getSchemaAndTableFromName,
  promptSelect,
  colors,
  AnyRakeDbConfig,
} from 'rake-db';
import { Adapter, ColumnType, DomainColumn, EnumColumn } from 'pqb';
import { promptCreateOrRename } from './generators.utils';
import {
  ColumnTypeBase,
  deepCompare,
  RecordUnknown,
  toSnakeCase,
} from 'orchid-core';
import { ChangeTableData, CompareSql } from './tables.generator';
import { AbortSignal } from '../generate';

export interface TypeCastsCache {
  value?: Map<string, Set<string>>;
}

type ColumnsToChange = Map<
  string,
  { key: string; dbName: string; column: ColumnType }
>;

export const processColumns = async (
  adapter: Adapter,
  config: AnyRakeDbConfig,
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  changeTableData: ChangeTableData,
  ast: RakeDbAst[],
  currentSchema: string,
  compareSql: CompareSql,
  typeCastsCache: TypeCastsCache,
  verifying: boolean | undefined,
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
    config,
    dbStructure,
    changeTableData,
    columnsToAdd,
    columnsToDrop,
    columnsToChange,
    verifying,
  );

  await changeColumns(
    adapter,
    config,
    structureToAstCtx,
    dbStructure,
    domainsMap,
    ast,
    currentSchema,
    dbColumns,
    columnsToChange,
    compareSql,
    changeTableData,
    typeCastsCache,
    verifying,
  );

  dropColumns(changeTableData, columnsToDrop);
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
  columnsToChange: ColumnsToChange;
} => {
  const columnsToAdd: { key: string; column: ColumnType }[] = [];
  const columnsToDrop: { key: string; column: ColumnType }[] = [];
  const columnsToChange: ColumnsToChange = new Map();
  const columnsToChangeByDbName = new Map<string, true>();

  const { codeTable, dbTable, dbTableData } = changeTableData;
  const checks = getDbTableColumnsChecks(changeTableData.dbTableData);

  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    // skip virtual columns
    if (!column.dataType) continue;

    const name = column.data.name ?? key;
    if (dbColumns[name]) {
      columnsToChange.set(key, { key, dbName: name, column });
      columnsToChangeByDbName.set(name, true);
    } else {
      columnsToAdd.push({ key, column });
    }
  }

  for (const name in dbColumns) {
    if (columnsToChangeByDbName.has(name)) continue;

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
  config: AnyRakeDbConfig,
  dbStructure: IntrospectedStructure,
  {
    dbTableData,
    schema,
    changeTableAst: { name: tableName, shape },
  }: ChangeTableData,
  columnsToAdd: KeyAndColumn[],
  columnsToDrop: KeyAndColumn[],
  columnsToChange: ColumnsToChange,
  verifying: boolean | undefined,
) => {
  for (const { key, column } of columnsToAdd) {
    if (columnsToDrop.length) {
      const codeName = column.data.name ?? key;
      const index = await promptCreateOrRename(
        'column',
        codeName,
        columnsToDrop.map((x) => x.key),
        verifying,
      );
      if (index) {
        const drop = columnsToDrop[index - 1];
        columnsToDrop.splice(index - 1, 1);

        const from = drop.column.data.name ?? drop.key;
        // TODO
        columnsToChange.set(drop.column.data.name ?? from, {
          key,
          dbName: drop.column.data.name ?? from,
          column: column.name(codeName),
        });

        const to = config.snakeCase ? toSnakeCase(key) : key;

        if (dbTableData.primaryKey) {
          renameColumn(dbTableData.primaryKey.columns, from, to);
        }

        for (const index of dbTableData.indexes) {
          for (const column of index.columns) {
            if ('column' in column && column.column === from) {
              column.column = to;
            }
          }
        }

        for (const c of dbTableData.constraints) {
          if (c.check?.columns) {
            renameColumn(c.check.columns, from, to);
          }
          if (c.references) {
            renameColumn(c.references.columns, from, to);
          }
        }

        for (const c of dbStructure.constraints) {
          if (
            c.references &&
            c.references.foreignSchema === schema &&
            c.references.foreignTable === tableName
          ) {
            renameColumn(c.references.foreignColumns, from, to);
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

const changeColumns = async (
  adapter: Adapter,
  config: AnyRakeDbConfig,
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  dbColumns: { [K: string]: DbStructure.Column },
  columnsToChange: ColumnsToChange,
  compareSql: CompareSql,
  changeTableData: ChangeTableData,
  typeCastsCache: TypeCastsCache,
  verifying: boolean | undefined,
) => {
  for (const [
    key,
    { key: codeKey, dbName, column: codeColumn },
  ] of columnsToChange) {
    const dbColumnStructure = dbColumns[dbName];

    const { shape } = changeTableData.changeTableAst;

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
      let typeCasts = typeCastsCache.value;
      if (!typeCasts) {
        const { rows } = await adapter.arrays(`SELECT s.typname, t.typname
FROM pg_cast
JOIN pg_type AS s ON s.oid = castsource
JOIN pg_type AS t ON t.oid = casttarget`);

        const directTypeCasts = new Map<string, Set<string>>();
        for (const [source, target] of rows) {
          const set = directTypeCasts.get(source);
          if (set) {
            set.add(target);
          } else {
            directTypeCasts.set(source, new Set([target]));
          }
        }

        typeCasts = new Map<string, Set<string>>();
        for (const [type, directSet] of directTypeCasts.entries()) {
          const set = new Set<string>(directSet);
          typeCasts.set(type, set);

          for (const subtype of directSet) {
            const subset = directTypeCasts.get(subtype);
            if (subset) {
              for (const type of subset) {
                set.add(type);
              }
            }
          }
        }

        typeCastsCache.value = typeCasts;
      }

      const dbBaseType =
        dbColumn instanceof DomainColumn
          ? domainsMap[dbColumn.dataType]?.dataType
          : dbType;

      const codeBaseType =
        codeColumn instanceof DomainColumn
          ? domainsMap[codeColumn.dataType]?.dataType
          : codeType;

      if (!typeCasts.get(dbBaseType)?.has(codeBaseType)) {
        if (
          !(dbColumn instanceof EnumColumn) ||
          !(codeColumn instanceof EnumColumn) ||
          !deepCompare(dbColumn.options, codeColumn.options)
        ) {
          if (verifying) throw new AbortSignal();

          const tableName = concatSchemaAndName(changeTableData.changeTableAst);
          const abort = await promptSelect({
            message: `Cannot cast type of ${tableName}'s column ${key} from ${dbType} to ${codeType}`,
            options: [
              `${colors.yellowBold(
                `-/+`,
              )} recreate the column, existing data will be ${colors.red(
                'lost',
              )}`,
              `write migration manually`,
            ],
          });
          if (abort) {
            throw new AbortSignal();
          }

          dbColumn.data.name = codeColumn.data.name;
          shape[key] = [
            {
              type: 'drop',
              item: dbColumn,
            },
            {
              type: 'add',
              item: codeColumn,
            },
          ];

          return;
        }
      }

      changed = true;
    }

    const dbData = dbColumn.data as unknown as RecordUnknown;
    const codeData = codeColumn.data as unknown as RecordUnknown;

    if (!changed) {
      if (!dbData.isNullable) dbData.isNullable = undefined;

      for (const key of ['isNullable', 'comment']) {
        if (dbData[key] !== codeData[key]) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      for (const key of [
        'maxChars',
        'collation',
        'compression',
        'numericPrecision',
        'numericScale',
        'dateTimePrecision',
      ]) {
        // Check if key in codeData so that default precision/scale values for such columns as integer aren't counted.
        // If column supports precision/scale, it should have it listed in the data, even if it's undefined.
        if (key in codeData && dbData[key] !== codeData[key]) {
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
            changeColumn(shape, key, dbColumn, codeColumn);
            if (!changeTableData.pushedAst) {
              changeTableData.pushedAst = true;
              ast.push(changeTableData.changeTableAst);
            }
          },
        });
      }
    }

    if (changed) {
      changeColumn(shape, key, dbColumn, codeColumn);
    } else {
      const to = codeColumn.data.name ?? codeKey;
      if (dbName !== to) {
        shape[
          config.snakeCase
            ? dbName === toSnakeCase(codeKey)
              ? codeKey
              : dbName
            : dbName
        ] = {
          type: 'rename',
          name: config.snakeCase
            ? to === toSnakeCase(codeKey)
              ? codeKey
              : to
            : to,
        };
      }
    }
  }
};

const changeColumn = (
  shape: RakeDbAst.ChangeTableShape,
  name: string,
  dbColumn: ColumnType,
  codeColumn: ColumnType,
) => {
  dbColumn.data.as = codeColumn.data.as = undefined;

  shape[name] = {
    type: 'change',
    from: { column: dbColumn },
    to: { column: codeColumn },
  };
};

export const getColumnDbType = (
  column: ColumnTypeBase,
  currentSchema: string,
) => {
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
