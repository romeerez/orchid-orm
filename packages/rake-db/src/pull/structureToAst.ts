import { DbStructure } from './dbStructure';
import { RakeDbAst } from '../ast';
import {
  ArrayColumn,
  columnCode,
  ColumnFromDbParams,
  columnsByType,
  ColumnsShape,
  ColumnType,
  CustomTypeColumn,
  DomainColumn,
  EnumColumn,
  ForeignKeyOptions,
  instantiateColumn,
  TableData,
} from 'pqb';
import { Code, raw, singleQuote } from 'orchid-core';
import { getForeignKeyName, getIndexName } from '../migration/migrationUtils';
import { RakeDbConfig } from '../common';

export class RakeDbEnumColumn extends EnumColumn<
  string,
  [string, ...string[]]
> {
  toCode(t: string): Code {
    return columnCode(this, t, `enum('${this.enumName}')`);
  }
}

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
  checks: DbStructure.Check[];
  domains: DbStructure.Domain[];
};

type Domains = Record<string, ColumnType>;

type PendingTables = Record<
  string,
  { table: DbStructure.Table; dependsOn: Set<string> }
>;

export const structureToAst = async (
  config: Pick<RakeDbConfig, 'logger'>,
  db: DbStructure,
): Promise<RakeDbAst[]> => {
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

  const domains: Domains = {};
  for (const it of data.domains) {
    domains[`${it.schemaName}.${it.name}`] = getColumn(config, data, domains, {
      schemaName: it.schemaName,
      name: it.name,
      type: it.type,
      typeSchema: it.typeSchema,
      isArray: it.isArray,
      isSerial: false,
    });
  }

  for (const key in pendingTables) {
    const { table, dependsOn } = pendingTables[key];
    if (!dependsOn.size) {
      pushTableAst(config, ast, data, domains, table, pendingTables);
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

  for (const it of data.domains) {
    ast.push({
      type: 'domain',
      action: 'create',
      schema: it.schemaName === 'public' ? undefined : it.schemaName,
      name: it.name,
      baseType: domains[`${it.schemaName}.${it.name}`],
      notNull: it.notNull,
      collation: it.collation,
      default: it.default ? raw(it.default) : undefined,
      check: it.check ? raw(it.check) : undefined,
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

    pushTableAst(config, ast, data, domains, table, pendingTables, innerFKeys);
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
    checks,
    domains,
  ] = await Promise.all([
    db.getSchemas(),
    db.getTables(),
    db.getColumns(),
    db.getPrimaryKeys(),
    db.getIndexes(),
    db.getForeignKeys(),
    db.getExtensions(),
    db.getEnums(),
    db.getChecks(),
    db.getDomains(),
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
    checks,
    domains,
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

const getColumn = (
  config: Pick<RakeDbConfig, 'logger'>,
  data: Data,
  domains: Domains,
  {
    schemaName,
    tableName,
    name,
    type,
    typeSchema,
    isArray,
    isSerial,
    ...params
  }: {
    schemaName: string;
    tableName?: string;
    name: string;
    type: string;
    typeSchema: string;
    isArray: boolean;
    isSerial: boolean;
  } & ColumnFromDbParams,
) => {
  let column: ColumnType;

  const klass = columnsByType[getColumnType(type, isSerial)];
  if (klass) {
    column = instantiateColumn(klass, params);
  } else {
    const domainColumn = domains[`${typeSchema}.${type}`];
    if (domainColumn) {
      column = new DomainColumn({}, type).as(domainColumn);
    } else {
      const enumType = data.enums.find(
        (item) => item.name === type && item.schemaName === typeSchema,
      );
      if (enumType) {
        column = new RakeDbEnumColumn({}, type, enumType.values);
      } else {
        column = new CustomTypeColumn({}, type);

        config.logger?.warn(
          `${tableName ? 'Column' : 'Domain'} ${schemaName}${
            tableName ? `.${tableName}` : ''
          }.${name} has unsupported type \`${type}\`, append \`as\` method manually to it to treat it as other column type`,
        );
      }
    }
  }

  return isArray ? new ArrayColumn({}, column) : column;
};

const getColumnType = (type: string, isSerial: boolean) => {
  if (!isSerial) return type;

  return type === 'int2'
    ? 'smallserial'
    : type === 'int4'
    ? 'serial'
    : 'bigserial';
};

const pushTableAst = (
  config: Pick<RakeDbConfig, 'logger'>,
  ast: RakeDbAst[],
  data: Data,
  domains: Domains,
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

  const columnChecks: Record<string, DbStructure.Check> = {};
  for (const check of data.checks) {
    if (check.columnNames.length === 1) {
      columnChecks[check.columnNames[0]] = check;
    }
  }

  const shape: ColumnsShape = {};
  for (let item of columns) {
    const isSerial = getIsSerial(item);
    if (isSerial) {
      item = { ...item, default: undefined };
    }

    const isArray = item.dataType === 'ARRAY';

    let column = getColumn(config, data, domains, {
      ...item,
      type: isArray ? item.type.slice(1) : item.type,
      isArray,
      isSerial,
    });

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

    const check = columnChecks[item.name];
    if (check) {
      column.data.check = raw(check.expression);
    }

    delete column.data.name;
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
      pushTableAst(config, ast, data, domains, item.table, pendingTables);
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
