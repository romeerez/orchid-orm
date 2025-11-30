import {
  RakeDbAst,
  dbColumnToAst,
  getDbTableColumnsChecks,
  instantiateDbColumn,
  StructureToAstCtx,
  DbStructure,
  IntrospectedStructure,
  encodeColumnDefault,
  concatSchemaAndName,
  getSchemaAndTableFromName,
  promptSelect,
  AnyRakeDbConfig,
} from 'rake-db';
import {
  ArrayColumn,
  ColumnType,
  DbStructureDomainsMap,
  EnumColumn,
  getColumnBaseType,
  ColumnTypeBase,
  deepCompare,
  RecordUnknown,
  toSnakeCase,
  colors,
  AdapterBase,
} from 'pqb';
import { promptCreateOrRename } from './generators.utils';
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
  adapter: AdapterBase,
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
      const i = await promptCreateOrRename(
        'column',
        codeName,
        columnsToDrop.map((x) => x.key),
        verifying,
      );
      if (i) {
        const drop = columnsToDrop[i - 1];
        columnsToDrop.splice(i - 1, 1);

        const from = drop.column.data.name ?? drop.key;
        columnsToChange.set(from, {
          key,
          dbName: from,
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

        for (const exclude of dbTableData.excludes) {
          for (const column of exclude.columns) {
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
  adapter: AdapterBase,
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

    const dbColumn = instantiateDbColumn(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      dbColumnStructure,
    );

    const action = await compareColumns(
      adapter,
      domainsMap,
      ast,
      currentSchema,
      compareSql,
      changeTableData,
      typeCastsCache,
      verifying,
      key,
      dbName,
      dbColumn,
      codeColumn,
    );

    if (action === 'change') {
      changeColumn(changeTableData, key, dbName, dbColumn, codeColumn);
    } else if (action === 'recreate') {
      changeTableData.changeTableAst.shape[key] = [
        {
          type: 'drop',
          item: dbColumn,
        },
        {
          type: 'add',
          item: codeColumn,
        },
      ];
    } else if (action !== 'recreate') {
      const to = codeColumn.data.name ?? codeKey;
      if (dbName !== to) {
        changeTableData.changeTableAst.shape[
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

const compareColumns = async (
  adapter: AdapterBase,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  compareSql: CompareSql,
  changeTableData: ChangeTableData,
  typeCastsCache: TypeCastsCache,
  verifying: boolean | undefined,
  key: string,
  dbName: string,
  dbColumn: ColumnType,
  codeColumn: ColumnType,
): Promise<'change' | 'recreate' | undefined> => {
  if (dbColumn instanceof ArrayColumn && codeColumn instanceof ArrayColumn) {
    dbColumn = dbColumn.data.item;
    codeColumn = codeColumn.data.item;
  }

  const dbType = getColumnDbType(dbColumn, currentSchema);
  const codeType = getColumnDbType(codeColumn, currentSchema);

  if (dbType !== codeType) {
    const typeCasts = await getTypeCasts(adapter, typeCastsCache);

    const dbBaseType = getColumnBaseType(dbColumn, domainsMap, dbType);
    const codeBaseType = getColumnBaseType(codeColumn, domainsMap, codeType);

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
        return 'recreate';
      }
    }

    return 'change';
  }

  const dbData = dbColumn.data as unknown as RecordUnknown;
  const codeData = codeColumn.data as unknown as RecordUnknown;

  for (const key of ['isNullable', 'comment']) {
    if (dbData[key] !== codeData[key]) {
      return 'change';
    }
  }

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
      return 'change';
    }
  }

  if (dbColumn.data.isOfCustomType) {
    const { typmod } = dbColumn.data;
    if (typmod !== undefined && typmod !== -1) {
      const i = codeColumn.dataType.indexOf('(');
      if (i === -1 || codeColumn.dataType.slice(i + 1, -1) !== `${typmod}`) {
        return 'change';
      }
    }
  }

  if (
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
    return 'change';
  }

  if (
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
      compareSql.values.length = valuesBeforeLen;
      return 'change';
    } else if (dbDefault !== codeDefault && dbDefault !== `(${codeDefault})`) {
      compareSql.expressions.push({
        inDb: dbDefault,
        inCode: codeDefault,
        change: () => {
          changeColumn(changeTableData, key, dbName, dbColumn, codeColumn);
          if (!changeTableData.pushedAst) {
            changeTableData.pushedAst = true;
            ast.push(changeTableData.changeTableAst);
          }
        },
      });
    }
  }

  return;
};

const getTypeCasts = async (
  adapter: AdapterBase,
  typeCastsCache: TypeCastsCache,
) => {
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

  return typeCasts;
};

const changeColumn = (
  changeTableData: ChangeTableData,
  key: string,
  dbName: string,
  dbColumn: ColumnType,
  codeColumn: ColumnType,
) => {
  dbColumn.data.as = codeColumn.data.as = undefined;

  const simpleCodeColumn = Object.create(codeColumn);
  simpleCodeColumn.data = {
    ...codeColumn.data,
    primaryKey: undefined,
    indexes: undefined,
    excludes: undefined,
    foreignKeys: undefined,
    check: undefined,
  };

  changeTableData.changingColumns[dbName] = {
    from: dbColumn,
    to: simpleCodeColumn,
  };

  changeTableData.changeTableAst.shape[key] = {
    type: 'change',
    from: { column: dbColumn },
    to: { column: simpleCodeColumn },
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
    return `${schema}.${name}`;
  } else if (column instanceof ArrayColumn) {
    const { item } = column.data;
    let type = item instanceof EnumColumn ? item.enumName : item.dataType;

    type = type.startsWith(currentSchema + '.')
      ? type.slice(currentSchema.length + 1)
      : type;

    return type + '[]'.repeat(column.data.arrayDims);
  } else if (column.data.isOfCustomType) {
    let type = column.dataType;

    const i = type.indexOf('(');
    if (i !== -1) {
      type = type.slice(0, i);
    }

    return type.includes('.') ? type : currentSchema + '.' + type;
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
