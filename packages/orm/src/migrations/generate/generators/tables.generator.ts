import { Column } from 'pqb/internal';
import {
  ArrayColumn,
  ColumnsShape,
  DbStructureDomainsMap,
  Adapter,
  EnumColumn,
  GeneratorIgnore,
  VirtualColumn,
} from 'pqb/internal';
import {
  DbStructure,
  IntrospectedStructure,
  RakeDbAst,
  getDbStructureTableData,
  StructureToAstCtx,
  StructureToAstTableData,
  tableToAst,
  getSchemaAndTableFromName,
  getMigrationsSchemaAndTable,
  RakeDbConfig,
} from 'rake-db';
import {
  CompareExpression,
  compareSqlExpressions,
  promptCreateOrRename,
  SqlExpression,
} from './generators.utils';
import { processPrimaryKey } from './primary-key.generator';
import { processIndexesAndExcludes } from './indexes-and-excludes.generator';
import { processColumns, TypeCastsCache } from './columns.generator';
import { processForeignKeys } from './foreign-keys.generator';
import { processChecks } from './checks.generator';
import { CodeTable } from '../generate';
import { ComposeMigrationParams, PendingDbTypes } from '../compose-migration';
import { processTableRls } from './rls.generator';

export interface CompareSql {
  values: unknown[];
  expressions: {
    inDb: string;
    inCode: string | null;
    change(): void;
  }[];
}

export interface ChangeTableSchemaData {
  codeTable: CodeTable;
  dbTable: DbStructure.Table;
}

export interface ChangeTableData extends ChangeTableSchemaData {
  dbTableData: StructureToAstTableData;
  schema: string;
  changeTableAst: RakeDbAst.ChangeTable;
  pushedAst: boolean;
  changingColumns: ChangingColumns;
  delayedAst: RakeDbAst[];
}

interface ChangingColumns {
  [dbName: string]: ChangingColumnsPair;
}

export interface ChangingColumnsPair {
  from: Column;
  to: Column;
}

export interface TableShapes {
  [K: string]: RakeDbAst.ChangeTableShape;
}

export const processTables = async (
  ast: RakeDbAst[],
  domainsMap: DbStructureDomainsMap,
  adapter: Adapter,
  dbStructure: IntrospectedStructure,
  config: RakeDbConfig,
  {
    structureToAstCtx,
    codeItems: { tables },
    currentSchema,
    internal: { generatorIgnore },
    verifying,
  }: ComposeMigrationParams,
  pendingDbTypes: PendingDbTypes,
): Promise<void> => {
  const createTables: CodeTable[] = collectCreateTables(
    tables,
    dbStructure,
    currentSchema,
  );
  const compareSql: CompareSql = { values: [], expressions: [] };
  const expressions: SqlExpression[] = [];
  const { changeTables, changeTableSchemas, dropTables, tableShapes } =
    collectChangeAndDropTables(
      adapter,
      config,
      tables,
      dbStructure,
      currentSchema,
      createTables,
      generatorIgnore,
    );

  applyChangeTableSchemas(changeTableSchemas, currentSchema, ast);

  await applyCreateOrRenameTables(
    dbStructure,
    createTables,
    dropTables,
    changeTables,
    tableShapes,
    currentSchema,
    ast,
    verifying,
  );

  await applyChangeTables(
    adapter,
    changeTables,
    structureToAstCtx,
    dbStructure,
    domainsMap,
    ast,
    currentSchema,
    config,
    compareSql,
    expressions,
    verifying,
    pendingDbTypes,
  );

  processForeignKeys(config, ast, changeTables, currentSchema, tableShapes);

  await Promise.all([
    applyCompareSql(compareSql, adapter),
    compareSqlExpressions(expressions, adapter),
  ]);

  await processTableRls(
    adapter,
    ast,
    dbStructure,
    tables,
    currentSchema,
    generatorIgnore,
  );

  for (const dbTable of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, dbTable, 'drop', domainsMap),
    );
  }
};

const collectCreateTables = (
  tables: CodeTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
): CodeTable[] => {
  return tables.reduce<CodeTable[]>((acc, codeTable) => {
    if (codeTable.internal.generatorIgnored) return acc;

    const tableSchema = codeTable.q.schema ?? currentSchema;
    const hasDbTable = dbStructure.tables.some(
      (t) => t.name === codeTable.table && t.schemaName === tableSchema,
    );
    if (!hasDbTable) {
      acc.push(codeTable);
    }
    return acc;
  }, []);
};

const collectChangeAndDropTables = (
  adapter: Adapter,
  config: RakeDbConfig,
  tables: CodeTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  createTables: CodeTable[],
  generatorIgnore: GeneratorIgnore | undefined,
): {
  changeTables: ChangeTableData[];
  changeTableSchemas: ChangeTableSchemaData[];
  dropTables: DbStructure.Table[];
  tableShapes: TableShapes;
} => {
  const changeTables: ChangeTableData[] = [];
  const changeTableSchemas: ChangeTableSchemaData[] = [];
  const dropTables: DbStructure.Table[] = [];
  const tableShapes: TableShapes = {};
  const ignoreTables = generatorIgnore?.tables?.map((name) => {
    const [schema = currentSchema, table] = getSchemaAndTableFromName(
      currentSchema,
      name,
    );
    return { schema, table };
  });

  const { schema: migrationsSchema = 'public', table: migrationsTable } =
    getMigrationsSchemaAndTable(adapter, config);
  for (const dbTable of dbStructure.tables) {
    if (
      (dbTable.name === migrationsTable &&
        dbTable.schemaName === migrationsSchema) ||
      generatorIgnore?.schemas?.includes(dbTable.schemaName) ||
      ignoreTables?.some(
        ({ schema, table }) =>
          table === dbTable.name && schema === dbTable.schemaName,
      ) ||
      isDefinitionIgnoredDbTable(tables, dbTable, currentSchema)
    )
      continue;

    const codeTable = tables.find(
      (t) =>
        t.table === dbTable.name &&
        (t.q.schema ?? currentSchema) === dbTable.schemaName,
    );
    if (codeTable) {
      addChangeTable(
        dbStructure,
        changeTables,
        tableShapes,
        currentSchema,
        dbTable,
        codeTable,
      );
      continue;
    }

    const i = createTables.findIndex((t) => t.table === dbTable.name);
    if (i !== -1) {
      const codeTable = createTables[i];
      createTables.splice(i, 1);
      changeTableSchemas.push({ codeTable, dbTable });
      continue;
    }

    dropTables.push(dbTable);
  }

  return { changeTables, changeTableSchemas, dropTables, tableShapes };
};

const isDefinitionIgnoredDbTable = (
  tables: CodeTable[],
  dbTable: DbStructure.Table,
  currentSchema: string,
): boolean => {
  let hasIgnoredSameName = false;

  for (const codeTable of tables) {
    if (codeTable.table !== dbTable.name) continue;

    const schema = codeTable.q.schema ?? currentSchema;
    if (schema === dbTable.schemaName) {
      return !!codeTable.internal.generatorIgnored;
    }

    if (codeTable.internal.generatorIgnored) {
      hasIgnoredSameName = true;
    }
  }

  return hasIgnoredSameName;
};

const applyChangeTableSchemas = (
  changeTableSchemas: ChangeTableSchemaData[],
  currentSchema: string,
  ast: RakeDbAst[],
) => {
  for (const { codeTable, dbTable } of changeTableSchemas) {
    const fromSchema = dbTable.schemaName;
    const toSchema = codeTable.q.schema ?? currentSchema;

    ast.push({
      type: 'renameType',
      kind: 'TABLE',
      fromSchema,
      from: dbTable.name,
      toSchema,
      to: dbTable.name,
    });
  }
};

const applyChangeTables = async (
  adapter: Adapter,
  changeTables: ChangeTableData[],
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  config: RakeDbConfig,
  compareSql: CompareSql,
  expressions: SqlExpression[],
  verifying: boolean | undefined,
  pendingDbTypes: PendingDbTypes,
): Promise<void> => {
  const compareExpressions: CompareExpression[] = [];
  const typeCastsCache: TypeCastsCache = {};

  for (const changeTableData of changeTables) {
    compareExpressions.length = 0;

    await processTableChange(
      adapter,
      structureToAstCtx,
      dbStructure,
      domainsMap,
      ast,
      currentSchema,
      config,
      changeTableData,
      compareSql,
      compareExpressions,
      typeCastsCache,
      verifying,
    );

    if (compareExpressions.length) {
      const { codeTable } = changeTableData;
      const names: string[] = [];
      const types: string[] = [];

      for (const key in codeTable.shape) {
        const column = codeTable.shape[key] as Column;
        // skip virtual columns
        if (!column.dataType) continue;

        const name = column.data.name ?? key;
        const type = getColumnDbTypeForComparison(column, currentSchema);
        if (!pendingDbTypes.set.has(type)) {
          names.push(name);
          types.push(type);
        }
      }

      const tableName = codeTable.table;
      const source = `(VALUES (${types
        .map((x) => `NULL::${x}`)
        .join(', ')})) "${tableName}"(${names
        .map((x) => `"${x}"`)
        .join(', ')})`;

      expressions.push(...compareExpressions.map((x) => ({ ...x, source })));
    }
  }
};

const getColumnDbTypeForComparison = (
  column: Column.Pick.DataAndDataType,
  currentSchema: string,
): string => {
  if (column instanceof ArrayColumn) {
    return (
      getColumnDbTypeForComparison(column.data.item, currentSchema) +
      '[]'.repeat(column.data.arrayDims)
    );
  }

  let type = column instanceof EnumColumn ? column.enumName : column.dataType;

  const i = type.indexOf('(');
  let append = '';
  if (i !== -1) {
    type = type.slice(0, i);
    append = type.slice(i);
  }

  const j = type.indexOf('.');
  if (j === -1) {
    let result = `"${type}"${append}`;
    if (column.data.isOfCustomType || column instanceof EnumColumn) {
      result = `"${currentSchema}".${result}`;
    }
    return result;
  } else {
    return `"${type.slice(j)}"."${type.slice(0, j)}"${append}`;
  }
};

// https://github.com/romeerez/orchid-orm/issues/647
// two clock_timestamp() statements aren't equal to each other, confusing SQL comparator.
// adding 0.1ms to keep clock_timestamp() different from now(), so user can migrate from now() to clock_timestamp().
const freezeSqlClock = (sql: string) =>
  sql.replaceAll('clock_timestamp()', `'0.1ms'::interval + now()`);

const applyCompareSql = async (compareSql: CompareSql, adapter: Adapter) => {
  if (compareSql.expressions.length) {
    const {
      rows: [results],
    } = await adapter.arrays(
      'SELECT ' +
        compareSql.expressions
          .map(
            (x, i) =>
              `${freezeSqlClock(x.inDb)} = (${
                x.inCode && freezeSqlClock(x.inCode)
              }) "${i}"`,
          )
          .join(', '),
      compareSql.values,
    );

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        compareSql.expressions[i].change();
      }
    }
  }
};

const applyCreateOrRenameTables = async (
  dbStructure: IntrospectedStructure,
  createTables: CodeTable[],
  dropTables: DbStructure.Table[],
  changeTables: ChangeTableData[],
  tableShapes: TableShapes,
  currentSchema: string,
  ast: RakeDbAst[],
  verifying: boolean | undefined,
) => {
  for (const codeTable of createTables) {
    if (dropTables.length) {
      const i = await promptCreateOrRename(
        'table',
        codeTable.table,
        dropTables.map((x) => x.name),
        verifying,
      );
      if (i) {
        const dbTable = dropTables[i - 1];
        dropTables.splice(i - 1, 1);

        ast.push({
          type: 'renameType',
          kind: 'TABLE',
          fromSchema: dbTable.schemaName,
          from: dbTable.name,
          toSchema: codeTable.q.schema ?? currentSchema,
          to: codeTable.table,
        });

        addChangeTable(
          dbStructure,
          changeTables,
          tableShapes,
          currentSchema,
          dbTable,
          codeTable,
        );

        continue;
      }
    }

    ast.push(createTableAst(currentSchema, codeTable));
  }
};

const addChangeTable = (
  dbStructure: IntrospectedStructure,
  changeTables: ChangeTableData[],
  tableShapes: TableShapes,
  currentSchema: string,
  dbTable: DbStructure.Table,
  codeTable: CodeTable,
) => {
  const shape = {};
  const schema = codeTable.q.schema ?? currentSchema;

  changeTables.push({
    codeTable: cloneCodeTableForChange(codeTable),
    dbTable,
    dbTableData: getDbStructureTableData(dbStructure, dbTable),
    schema,
    changeTableAst: {
      type: 'changeTable',
      schema,
      name: codeTable.table,
      shape: shape,
      add: {},
      drop: {},
    },
    pushedAst: false,
    changingColumns: {},
    delayedAst: [],
  });

  tableShapes[`${schema}.${codeTable.table}`] = shape;
};

const cloneCodeTableForChange = (codeTable: CodeTable) => ({
  ...codeTable,
  // codeTable is a class instance and not all props can be cloned with `...`
  table: codeTable.table,
  shape: Object.fromEntries(
    Object.entries(codeTable.shape).map(([key, column]) => {
      const cloned = Object.create(column as Column);
      cloned.data = {
        ...cloned.data,
        checks: cloned.data.checks && [...cloned.data.checks],
      };

      return [key, cloned];
    }),
  ),
});

const createTableAst = (
  currentSchema: string,
  table: CodeTable,
): RakeDbAst.Table => {
  return {
    type: 'table',
    action: 'create',
    schema: table.q.schema === currentSchema ? undefined : table.q.schema,
    comment: table.internal.comment,
    name: table.table,
    shape: makeTableShape(table),
    noPrimaryKey: table.internal.noPrimaryKey ? 'ignore' : 'error',
    ...table.internal.tableData,
  };
};

const makeTableShape = (table: CodeTable): ColumnsShape => {
  const shape: ColumnsShape = {};
  for (const key in table.shape) {
    const column = table.shape[key];
    if (!(column instanceof VirtualColumn)) {
      shape[key] = column as Column;
    }
  }
  return shape;
};

const processTableChange = async (
  adapter: Adapter,
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  config: RakeDbConfig,
  changeTableData: ChangeTableData,
  compareSql: CompareSql,
  compareExpressions: CompareExpression[],
  typeCastsCache: TypeCastsCache,
  verifying: boolean | undefined,
) => {
  await processColumns(
    adapter,
    config,
    structureToAstCtx,
    dbStructure,
    domainsMap,
    changeTableData,
    ast,
    currentSchema,
    compareSql,
    typeCastsCache,
    verifying,
  );

  processPrimaryKey(config, changeTableData);

  processIndexesAndExcludes(config, changeTableData, ast, compareExpressions);

  processChecks(ast, changeTableData, compareExpressions);

  const { changeTableAst } = changeTableData;
  if (
    Object.keys(changeTableAst.shape).length ||
    Object.keys(changeTableAst.add).length ||
    Object.keys(changeTableAst.drop).length
  ) {
    changeTableData.pushedAst = true;
    ast.push(changeTableAst);
  }

  if (changeTableData.delayedAst.length) {
    ast.push(...changeTableData.delayedAst);
  }
};
