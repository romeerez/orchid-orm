import {
  AppCodeUpdaterRelations,
  AppCodeUpdaterGetTable,
} from '../appCodeUpdater';

export type HandleForeignKeysParams = {
  getTable: AppCodeUpdaterGetTable;
  relations: AppCodeUpdaterRelations;
  tableName: string;
  columns: string[];
  foreignTableName: string;
  foreignColumns: string[];
  skipBelongsTo?: boolean;
};

export const handleForeignKey = async ({
  getTable,
  relations,
  tableName,
  columns,
  foreignTableName,
  foreignColumns,
  skipBelongsTo,
}: HandleForeignKeysParams) => {
  const table = await getTable(tableName);
  if (!table) return;

  const foreignTable = await getTable(foreignTableName);
  if (!foreignTable) return;

  if (!skipBelongsTo) {
    relations[tableName] ??= {
      path: table.path,
      relations: [],
    };

    relations[tableName].relations.push({
      kind: 'belongsTo',
      columns,
      className: foreignTable.name,
      path: foreignTable.path,
      foreignColumns,
    });
  }

  relations[foreignTableName] ??= {
    path: foreignTable.path,
    relations: [],
  };

  relations[foreignTableName].relations.push({
    kind: 'hasMany',
    columns: foreignColumns,
    className: table.name,
    path: table.path,
    foreignColumns: columns,
  });
};
