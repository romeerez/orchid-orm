import { DbStructure } from './dbStructure';
import { RakeDbAst } from '../ast';
import {
  columnsByType,
  ColumnsShape,
  ForeignKeyOptions,
  instantiateColumn,
  singleQuote,
  TableData,
} from 'pqb';
import { getForeignKeyName, getIndexName } from '../migration/migrationUtils';

const matchMap = {
  s: undefined,
  f: 'FULL',
  p: 'PARTIAL',
};

const fkeyActionMap = {
  a: undefined, // default
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

type Data = {
  schemas: string[];
  tables: DbStructure.Table[];
  columns: DbStructure.Column[];
  primaryKeys: DbStructure.PrimaryKey[];
  indexes: DbStructure.Index[];
  foreignKeys: DbStructure.ForeignKey[];
  extensions: DbStructure.Extension[];
  enums: DbStructure.Enum[];
};

type PendingTables = Record<
  string,
  { table: DbStructure.Table; dependsOn: Set<string> }
>;

export const structureToAst = async (db: DbStructure): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];

  const data = await getData(db);

  for (const name of data.schemas) {
    if (name === 'public') continue;

    ast.push({
      type: 'schema',
      action: 'create',
      name,
    });
  }

  const pendingTables: PendingTables = {};
  for (const table of data.tables) {
    const key = `${table.schemaName}.${table.name}`;
    const dependsOn = new Set<string>();

    for (const fk of data.foreignKeys) {
      if (fk.schemaName !== table.schemaName || fk.tableName !== table.name)
        continue;

      const otherKey = `${fk.foreignTableSchemaName}.${fk.foreignTableName}`;
      if (otherKey !== key) {
        dependsOn.add(otherKey);
      }
    }

    pendingTables[key] = { table, dependsOn };
  }

  for (const key in pendingTables) {
    const { table, dependsOn } = pendingTables[key];
    if (!dependsOn.size) {
      pushTableAst(ast, data, table, pendingTables);
    }
  }

  const outerFKeys: [DbStructure.ForeignKey, DbStructure.Table][] = [];

  for (const it of data.extensions) {
    ast.push({
      type: 'extension',
      action: 'create',
      name: it.name,
      schema: it.schemaName === 'public' ? undefined : it.schemaName,
      version: it.version,
    });
  }

  for (const it of data.enums) {
    ast.push({
      type: 'enum',
      action: 'create',
      name: it.name,
      schema: it.schemaName === 'public' ? undefined : it.schemaName,
      values: it.values,
    });
  }

  for (const key in pendingTables) {
    const innerFKeys: DbStructure.ForeignKey[] = [];
    const { table } = pendingTables[key];

    for (const fkey of data.foreignKeys) {
      if (fkey.schemaName !== table.schemaName || fkey.tableName !== table.name)
        continue;

      const otherKey = `${fkey.foreignTableSchemaName}.${fkey.foreignTableName}`;
      if (!pendingTables[otherKey] || otherKey === key) {
        innerFKeys.push(fkey);
      } else {
        outerFKeys.push([fkey, table]);
      }
    }

    pushTableAst(ast, data, table, pendingTables, innerFKeys);
  }

  for (const [fkey, table] of outerFKeys) {
    ast.push({
      ...foreignKeyToAst(fkey),
      type: 'foreignKey',
      action: 'create',
      tableSchema: table.schemaName === 'public' ? undefined : table.schemaName,
      tableName: fkey.tableName,
    });
  }

  return ast;
};

const getData = async (db: DbStructure): Promise<Data> => {
  const [
    schemas,
    tables,
    columns,
    primaryKeys,
    indexes,
    foreignKeys,
    extensions,
    enums,
  ] = await Promise.all([
    db.getSchemas(),
    db.getTables(),
    db.getColumns(),
    db.getPrimaryKeys(),
    db.getIndexes(),
    db.getForeignKeys(),
    db.getExtensions(),
    db.getEnums(),
  ]);

  return {
    schemas,
    tables,
    columns,
    primaryKeys,
    indexes,
    foreignKeys,
    extensions,
    enums,
  };
};

const makeBelongsToTable =
  (schema: string | undefined, table: string) =>
  (item: { schemaName: string; tableName: string }) =>
    item.schemaName === schema && item.tableName === table;

const getIsSerial = (item: DbStructure.Column) => {
  if (item.type === 'int2' || item.type === 'int4' || item.type === 'int8') {
    const { default: def, schemaName, tableName, name } = item;
    const seq = `${tableName}_${name}_seq`;
    if (
      def &&
      (def === `nextval(${singleQuote(`${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${seq}"`)}::regclass)` ||
        def === `nextval(${singleQuote(`${schemaName}.${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${schemaName}".${seq}`)}::regclass)` ||
        def === `nextval(${singleQuote(`${schemaName}."${seq}"`)}::regclass)` ||
        def === `nextval(${singleQuote(`"${schemaName}"."${seq}"`)}::regclass)`)
    ) {
      return true;
    }
  }

  return false;
};

const getColumnType = (item: DbStructure.Column, isSerial: boolean) => {
  if (isSerial) {
    return item.type === 'int2'
      ? 'smallserial'
      : item.type === 'int4'
      ? 'serial'
      : 'bigserial';
  }

  return item.type;
};

const pushTableAst = (
  ast: RakeDbAst[],
  data: Data,
  table: DbStructure.Table,
  pendingTables: PendingTables,
  innerFKeys = data.foreignKeys,
) => {
  const { schemaName, name } = table;

  const key = `${schemaName}.${table.name}`;
  delete pendingTables[key];

  if (name === 'schemaMigrations') return;

  const belongsToTable = makeBelongsToTable(schemaName, name);

  const columns = data.columns.filter(belongsToTable);
  const primaryKey = data.primaryKeys.find(belongsToTable);
  const tableIndexes = data.indexes.filter(belongsToTable);
  const tableForeignKeys = innerFKeys.filter(belongsToTable);

  const shape: ColumnsShape = {};
  for (let item of columns) {
    const isSerial = getIsSerial(item);
    if (isSerial) {
      item = { ...item, default: undefined };
    }

    const klass = columnsByType[getColumnType(item, isSerial)];
    if (!klass) {
      throw new Error(`Column type \`${item.type}\` is not supported`);
    }

    let column = instantiateColumn(klass, item);

    if (
      primaryKey?.columnNames.length === 1 &&
      primaryKey?.columnNames[0] === item.name
    ) {
      column = column.primaryKey();
    }

    const indexes = tableIndexes.filter(
      (it) =>
        it.columns.length === 1 &&
        'column' in it.columns[0] &&
        it.columns[0].column === item.name,
    );
    for (const index of indexes) {
      const options = index.columns[0];
      column = column.index({
        collate: options.collate,
        opclass: options.opclass,
        order: options.order,
        name:
          index.name !== getIndexName(name, index.columns)
            ? index.name
            : undefined,
        using: index.using === 'btree' ? undefined : index.using,
        unique: index.isUnique,
        include: index.include,
        with: index.with,
        tablespace: index.tablespace,
        where: index.where,
      });
    }

    const foreignKeys = tableForeignKeys.filter(
      (it) => it.columnNames.length === 1 && it.columnNames[0] === item.name,
    );
    for (const foreignKey of foreignKeys) {
      column = column.foreignKey(
        foreignKey.foreignTableName,
        foreignKey.foreignColumnNames[0],
        {
          name:
            foreignKey.name &&
            foreignKey.name !== getForeignKeyName(name, foreignKey.columnNames)
              ? foreignKey.name
              : undefined,
          match: matchMap[foreignKey.match],
          onUpdate: fkeyActionMap[foreignKey.onUpdate],
          onDelete: fkeyActionMap[foreignKey.onDelete],
        } as ForeignKeyOptions,
      );
    }

    shape[item.name] = column;
  }

  ast.push({
    type: 'table',
    action: 'create',
    schema: schemaName === 'public' ? undefined : schemaName,
    comment: table.comment,
    name: name,
    shape,
    noPrimaryKey: primaryKey ? 'error' : 'ignore',
    primaryKey:
      primaryKey && primaryKey.columnNames.length > 1
        ? {
            columns: primaryKey.columnNames,
            options:
              primaryKey.name === `${name}_pkey`
                ? undefined
                : { name: primaryKey.name },
          }
        : undefined,
    indexes: tableIndexes
      .filter(
        (index) =>
          index.columns.length > 1 ||
          index.columns.some((it) => 'expression' in it),
      )
      .map((index) => ({
        columns: index.columns.map((it) => ({
          ...('column' in it
            ? { column: it.column }
            : { expression: it.expression }),
          collate: it.collate,
          opclass: it.opclass,
          order: it.order,
        })),
        options: {
          name:
            index.name !== getIndexName(name, index.columns)
              ? index.name
              : undefined,
          using: index.using === 'btree' ? undefined : index.using,
          unique: index.isUnique,
          include: index.include,
          with: index.with,
          tablespace: index.tablespace,
          where: index.where,
        },
      })),
    foreignKeys: tableForeignKeys
      .filter((it) => it.columnNames.length > 1)
      .map(foreignKeyToAst),
  });

  for (const otherKey in pendingTables) {
    const item = pendingTables[otherKey];
    if (item.dependsOn.delete(key) && item.dependsOn.size === 0) {
      pushTableAst(ast, data, item.table, pendingTables);
    }
  }
};

const foreignKeyToAst = (
  fkey: DbStructure.ForeignKey,
): TableData.ForeignKey => ({
  columns: fkey.columnNames,
  fnOrTable: fkey.foreignTableName,
  foreignColumns: fkey.foreignColumnNames,
  options: {
    name:
      fkey.name &&
      fkey.name !== getForeignKeyName(fkey.tableName, fkey.columnNames)
        ? fkey.name
        : undefined,
    match: matchMap[fkey.match],
    onUpdate: fkeyActionMap[fkey.onUpdate],
    onDelete: fkeyActionMap[fkey.onDelete],
  } as ForeignKeyOptions,
});
