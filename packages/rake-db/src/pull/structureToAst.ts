import { DbStructure } from './dbStructure';
import { RakeDbAst } from '../ast';
import {
  columnsByType,
  ColumnsShape,
  ForeignKeyOptions,
  instantiateColumn,
} from 'pqb';

const matchMap = {
  s: undefined,
  f: 'FULL',
  p: 'PARTIAL',
};

const fkeyActionMap = {
  a: 'NO ACTION',
  r: undefined, // default
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

export const structureToAst = async (db: DbStructure): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];

  const [
    schemas,
    tables,
    allColumns,
    allPrimaryKeys,
    allIndexes,
    allForeignKeys,
    extensions,
  ] = await Promise.all([
    db.getSchemas(),
    db.getTables(),
    db.getColumns(),
    db.getPrimaryKeys(),
    db.getIndexes(),
    db.getForeignKeys(),
    db.getExtensions(),
  ]);

  for (const name of schemas) {
    if (name === 'public') continue;

    ast.push({
      type: 'schema',
      action: 'create',
      name,
    });
  }

  for (const table of tables) {
    const { schemaName, name } = table;

    const belongsToTable = makeBelongsToTable(schemaName, name);

    const columns = allColumns.filter(belongsToTable);
    const primaryKey = allPrimaryKeys.find(belongsToTable);
    const tableIndexes = allIndexes.filter(belongsToTable);
    const tableForeignKeys = allForeignKeys.filter(belongsToTable);

    const shape: ColumnsShape = {};
    for (const item of columns) {
      const klass = columnsByType[item.type];
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
          name: index.name,
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
            name: foreignKey.name,
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
            name: index.name,
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
        .map((it) => ({
          columns: it.columnNames,
          fnOrTable: it.foreignTableName,
          foreignColumns: it.foreignColumnNames,
          options: {
            name: it.name,
            match: matchMap[it.match],
            onUpdate: fkeyActionMap[it.onUpdate],
            onDelete: fkeyActionMap[it.onDelete],
          } as ForeignKeyOptions,
        })),
    });
  }

  for (const it of extensions) {
    ast.push({
      type: 'extension',
      action: 'create',
      name: it.name,
      schema: it.schemaName === 'public' ? undefined : it.schemaName,
      version: it.version,
    });
  }

  return ast;
};

const makeBelongsToTable =
  (schema: string | undefined, table: string) =>
  (item: { schemaName: string; tableName: string }) =>
    item.schemaName === schema && item.tableName === table;
