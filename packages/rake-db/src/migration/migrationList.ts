import { ColumnTypesBase } from 'orchid-core';
import { DefaultColumnTypes } from 'pqb';
import { RakeDbConfig, getMigrations } from 'src/common';

const getFileNameFromPath = (path: string) => {
  const pathArray = path.split('/');
  // pick the file name from path & remove the time stamp.
  const fileName = pathArray[pathArray.length - 1].slice(15);
  return fileName;
};

const parseMigrationListRow = (path: string, direction: 'up' | 'down') =>
  `${direction} ${getFileNameFromPath(path)} ${path}`;

export const migrationList = async <
  C extends ColumnTypesBase = DefaultColumnTypes,
>(
  config: RakeDbConfig<C>,
) => {
  // get list of down migrations & log them.
  const downMigrationsList = await getMigrations(config, false);
  downMigrationsList.forEach((migrationItem) => {
    config.logger?.log(parseMigrationListRow(migrationItem.path, 'down'));
  });

  // get list of up migrations & log them.
  const upMigrationsList = await getMigrations(config, true);
  upMigrationsList.forEach((migrationItem) => {
    config.logger?.log(parseMigrationListRow(migrationItem.path, 'up'));
  });
};
