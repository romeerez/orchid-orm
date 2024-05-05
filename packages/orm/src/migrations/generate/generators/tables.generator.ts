import {
  Adapter,
  ColumnsShape,
  ColumnType,
  QueryWithTable,
  TableData,
  VirtualColumn,
} from 'pqb';
import {
  DbStructure,
  IntrospectedStructure,
  AnyRakeDbConfig,
  RakeDbAst,
  DbStructureDomainsMap,
  getDbStructureTableData,
  StructureToAstCtx,
  StructureToAstTableData,
  tableToAst,
} from 'rake-db';
import {
  CompareExpression,
  compareSqlExpressions,
  promptCreateOrRename,
  TableExpression,
} from './generators.utils';
import { processPrimaryKey } from './primaryKey.generator';
import { processIndexes } from './indexes.generator';
import {
  getColumnDbType,
  processColumns,
  TypeCastsCache,
} from './columns.generator';
import { processForeignKeys } from './foreignKeys.generator';
import { processChecks } from './checks.generator';

export interface CompareSql {
  values: unknown[];
  expressions: {
    inDb: string;
    inCode: string;
    change(): void;
  }[];
}

export interface ChangeTableSchemaData {
  codeTable: QueryWithTable;
  dbTable: DbStructure.Table;
}

export interface ChangeTableData extends ChangeTableSchemaData {
  dbTableData: StructureToAstTableData;
  schema: string;
  changeTableAst: RakeDbAst.ChangeTable;
  pushedAst: boolean;
}

export interface TableShapes {
  [K: string]: RakeDbAst.ChangeTableShape;
}

export const processTables = async (
  ast: RakeDbAst[],
  structureToAstCtx: StructureToAstCtx,
  domainsMap: DbStructureDomainsMap,
  adapter: Adapter,
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
  verifying: boolean | undefined,
): Promise<void> => {
  const createTables: QueryWithTable[] = collectCreateTables(
    tables,
    dbStructure,
    currentSchema,
  );
  const compareSql: CompareSql = { values: [], expressions: [] };
  const tableExpressions: TableExpression[] = [];
  const { changeTables, changeTableSchemas, dropTables, tableShapes } =
    collectChangeAndDropTables(
      tables,
      dbStructure,
      currentSchema,
      createTables,
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
    tableExpressions,
    verifying,
  );

  processForeignKeys(ast, changeTables, currentSchema, tableShapes);

  await Promise.all([
    applyCompareSql(compareSql, adapter),
    compareSqlExpressions(tableExpressions, adapter),
  ]);

  for (const dbTable of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, dbTable, 'drop', domainsMap),
    );
  }
};

const collectCreateTables = (
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
): QueryWithTable[] => {
  return tables.reduce<QueryWithTable[]>((acc, codeTable) => {
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
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  createTables: QueryWithTable[],
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

  for (const dbTable of dbStructure.tables) {
    if (dbTable.name === 'schemaMigrations') continue;

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
  config: AnyRakeDbConfig,
  compareSql: CompareSql,
  tableExpressions: TableExpression[],
  verifying: boolean | undefined,
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
        const column = codeTable.shape[key] as ColumnType;
        // skip virtual columns
        if (!column.dataType) continue;

        const name = column.data.name ?? key;
        names.push(name);
        types.push(getColumnDbType(column, currentSchema));
      }

      const tableName = codeTable.table;
      const source = `(VALUES (${types
        .map((x) => `NULL::${x}`)
        .join(', ')})) "${tableName}"(${names
        .map((x) => `"${x}"`)
        .join(', ')})`;

      tableExpressions.push(
        ...compareExpressions.map((x) => ({ ...x, source })),
      );
    }
  }
};

const applyCompareSql = async (compareSql: CompareSql, adapter: Adapter) => {
  if (compareSql.expressions.length) {
    const {
      rows: [results],
    } = await adapter.arrays({
      text:
        'SELECT ' +
        compareSql.expressions
          .map((x) => `${x.inDb} = (${x.inCode})`)
          .join(', '),
      values: compareSql.values,
    });

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        compareSql.expressions[i].change();
      }
    }
  }
};

const applyCreateOrRenameTables = async (
  dbStructure: IntrospectedStructure,
  createTables: QueryWithTable[],
  dropTables: DbStructure.Table[],
  changeTables: ChangeTableData[],
  tableShapes: TableShapes,
  currentSchema: string,
  ast: RakeDbAst[],
  verifying: boolean | undefined,
) => {
  for (const codeTable of createTables) {
    if (dropTables.length) {
      const index = await promptCreateOrRename(
        'table',
        codeTable.table,
        dropTables.map((x) => x.name),
        verifying,
      );
      if (index) {
        const dbTable = dropTables[index - 1];
        dropTables.splice(index - 1, 1);

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
  codeTable: QueryWithTable,
) => {
  const shape = {};
  const schema = codeTable.q.schema ?? currentSchema;

  changeTables.push({
    codeTable,
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
  });

  tableShapes[`${schema}.${codeTable.table}`] = shape;
};

const createTableAst = (
  currentSchema: string,
  table: QueryWithTable,
): RakeDbAst.Table => {
  return {
    type: 'table',
    action: 'create',
    schema: table.q.schema === currentSchema ? undefined : table.q.schema,
    comment: table.internal.comment,
    name: table.table,
    shape: makeTableShape(table),
    ...(table.internal as TableData),
    noPrimaryKey: table.internal.noPrimaryKey ? 'ignore' : 'error',
  };
};

const makeTableShape = (table: QueryWithTable): ColumnsShape => {
  const shape: ColumnsShape = {};
  for (const key in table.shape) {
    const column = table.shape[key];
    if (!(column instanceof VirtualColumn)) {
      shape[key] = column as ColumnType;
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
  config: AnyRakeDbConfig,
  changeTableData: ChangeTableData,
  compareSql: CompareSql,
  compareExpressions: CompareExpression[],
  typeCastsCache: TypeCastsCache,
  verifying: boolean | undefined,
) => {
  await processColumns(
    adapter,
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

  const delayedAst: RakeDbAst[] = [];

  processPrimaryKey(delayedAst, changeTableData);

  processIndexes(config, changeTableData, delayedAst, ast, compareExpressions);

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

  if (delayedAst.length) ast.push(...delayedAst);
};
