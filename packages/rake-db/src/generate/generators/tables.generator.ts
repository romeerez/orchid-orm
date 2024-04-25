import {
  Adapter,
  ColumnsShape,
  ColumnType,
  QueryWithTable,
  TableData,
  VirtualColumn,
} from 'pqb';
import { DbStructure, IntrospectedStructure } from '../dbStructure';
import { AnyRakeDbConfig, RakeDbAst } from 'rake-db';
import {
  DbStructureDomainsMap,
  getDbStructureTableData,
  makeDomainsMap,
  makeStructureToAstCtx,
  StructureToAstCtx,
  StructureToAstTableData,
  tableToAst,
} from '../structureToAst';
import { promptCreateOrRename } from './generators.utils';
import { processPrimaryKey } from './primaryKey.generator';
import { processIndexes } from './indexes.generator';
import { getColumnDbType, processColumns } from './columns.generator';
import { processForeignKeys } from './foreignKeys.generator';

export interface CompareSql {
  values: unknown[];
  expressions: {
    inDb: string;
    inCode: string;
    change(): void;
  }[];
}

export interface CompareExpression {
  compare: {
    inDb: string;
    inCode: string[];
  }[];
  handle(index?: number): void;
}

interface TableExpression extends CompareExpression {
  source: string;
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
  adapter: Adapter,
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createTables: QueryWithTable[] = collectCreateTables(
    tables,
    dbStructure,
    currentSchema,
  );
  const compareSql: CompareSql = { values: [], expressions: [] };
  const tableExpressions: TableExpression[] = [];
  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);
  const { changeTables, changeTableSchemas, dropTables, tableShapes } =
    collectChangeAndDropTables(
      tables,
      dbStructure,
      currentSchema,
      createTables,
    );

  applyChangeTableSchemas(changeTableSchemas, currentSchema, ast);

  await applyChangeTables(
    changeTables,
    structureToAstCtx,
    dbStructure,
    domainsMap,
    ast,
    currentSchema,
    config,
    compareSql,
    tableExpressions,
  );

  processForeignKeys(ast, changeTables, currentSchema, tableShapes);

  await Promise.all([
    applyCompareSql(compareSql, adapter),
    applyCompareTableExpressions(tableExpressions, adapter),
    applyCreateOrRenameTables(createTables, dropTables, currentSchema, ast),
  ]);

  for (const dbTable of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, dbTable, 'drop', domainsMap),
    );
  }

  return ast;
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
  changeTables: ChangeTableData[],
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  config: AnyRakeDbConfig,
  compareSql: CompareSql,
  tableExpressions: TableExpression[],
): Promise<void> => {
  const compareExpressions: CompareExpression[] = [];
  for (const changeTableData of changeTables) {
    compareExpressions.length = 0;

    await processTableChange(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      ast,
      currentSchema,
      config,
      changeTableData,
      compareSql,
      compareExpressions,
    );

    if (compareExpressions.length) {
      const { codeTable } = changeTableData;
      const names: string[] = [];
      const types: string[] = [];

      for (const key in codeTable.shape) {
        const column = codeTable.shape[key] as ColumnType;
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

const applyCompareTableExpressions = async (
  tableExpressions: TableExpression[],
  adapter: Adapter,
) => {
  if (tableExpressions.length) {
    let id = 1;
    await Promise.all(
      tableExpressions.map(async ({ source, compare, handle }) => {
        const viewName = `orchidTmpView${id++}`;
        try {
          const sql = `CREATE TEMPORARY VIEW ${viewName} AS (SELECT ${compare
            .map(
              ({ inDb, inCode }, i) =>
                `${inDb} AS "*inDb-${i}*", ${inCode
                  .map((s, j) => `(${s}) "*inCode-${i}-${j}*"`)
                  .join(', ')}`,
            )
            .join(', ')} FROM ${source})`;
          await adapter.query(sql);
        } catch (err) {
          handle();
          return;
        }

        const {
          rows: [{ v }],
        } = await adapter.query<{ v: string }>(
          `SELECT pg_get_viewdef('${viewName}') v`,
        );

        await adapter.query(`DROP VIEW ${viewName}`);

        let pos = 7;
        const rgx = /\s+AS\s+"\*(inDb-\d+|inCode-\d+-\d+)\*",?/g;
        let match;
        let inDb = '';
        let codeI = 0;
        const matches = compare[0].inCode.map(() => true);
        while ((match = rgx.exec(v))) {
          const sql = v.slice(pos, rgx.lastIndex - match[0].length).trim();
          const arr = match[1].split('-');
          if (arr.length === 2) {
            inDb = sql;
            codeI = 0;
          } else {
            if (inDb !== sql) {
              matches[codeI] = false;
            }
            codeI++;
          }
          pos = rgx.lastIndex;
        }

        const firstMatching = matches.indexOf(true);
        handle(firstMatching === -1 ? undefined : firstMatching);
      }),
    );
  }
};

const applyCreateOrRenameTables = async (
  createTables: QueryWithTable[],
  dropTables: DbStructure.Table[],
  currentSchema: string,
  ast: RakeDbAst[],
) => {
  for (const codeTable of createTables) {
    if (dropTables.length) {
      const index = await promptCreateOrRename(
        'table',
        codeTable.table,
        dropTables.map((x) => x.name),
      );
      if (index) {
        const drop = dropTables[index - 1];
        dropTables.splice(index - 1, 1);

        ast.push({
          type: 'renameType',
          kind: 'TABLE',
          fromSchema: drop.schemaName,
          from: drop.name,
          toSchema: codeTable.q.schema ?? currentSchema,
          to: codeTable.table,
        });

        continue;
      }
    }

    ast.push(createTableAst(currentSchema, codeTable));
  }
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
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  config: AnyRakeDbConfig,
  changeTableData: ChangeTableData,
  compareSql: CompareSql,
  compareExpressions: CompareExpression[],
) => {
  await processColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    changeTableData,
    ast,
    currentSchema,
    compareSql,
  );

  const delayedAst: RakeDbAst[] = [];

  processPrimaryKey(delayedAst, changeTableData);

  processIndexes(config, changeTableData, delayedAst, ast, compareExpressions);

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
