import { DbStructure } from './dbStructure';
import { RakeDbAst } from '../ast';
import { columnsByType, ColumnsShape, instantiateColumn } from 'pqb';

export const structureToAst = async (db: DbStructure): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];

  const [
    schemas,
    tables,
    allColumns,
    allConstraints,
    allIndexes,
    allForeignKeys,
    extensions,
  ] = await Promise.all([
    db.getSchemas(),
    db.getTables(),
    db.getColumns(),
    db.getConstraints(),
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
    const tableConstraints = allConstraints.filter(belongsToTable);
    const primaryKey = tableConstraints.find(
      (item) => item.type === 'PRIMARY KEY',
    );
    const tableIndexes = allIndexes.filter(belongsToTable);
    const tableForeignKeys = allForeignKeys.filter(belongsToTable);

    const shape: ColumnsShape = {};
    for (const item of columns) {
      const klass = columnsByType[item.type];
      let column = instantiateColumn(klass, item);

      if (
        primaryKey?.columnNames.length === 1 &&
        primaryKey?.columnNames[0] === item.name
      ) {
        column = column.primaryKey();
      }

      const index = tableIndexes.find(
        (it) =>
          it.isPrimary === false &&
          it.columnNames.length === 1 &&
          it.columnNames[0] === item.name,
      );
      if (index) {
        column = column.index({
          name: index.name,
          unique: index.isUnique,
        });
      }

      const foreignKey = tableForeignKeys.find(
        (it) => it.columnNames.length === 1 && it.columnNames[0] === item.name,
      );
      if (foreignKey) {
        column = column.foreignKey(
          foreignKey.foreignTableName,
          foreignKey.foreignColumnNames[0],
          {
            name: foreignKey.name,
          },
        );
      }

      shape[item.name] = column;
    }

    ast.push({
      type: 'table',
      action: 'create',
      schema: schemaName === 'public' ? undefined : schemaName,
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
        .filter((index) => index.columnNames.length > 1)
        .map((index) => ({
          columns: index.columnNames.map((column) => ({ column })),
          options: {
            name: index.name,
            unique: index.isUnique,
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
          },
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
