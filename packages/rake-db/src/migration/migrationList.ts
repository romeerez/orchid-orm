import { ColumnTypesBase } from 'orchid-core';
import { DefaultColumnTypes } from 'pqb';
import { MigrationItem, RakeDbConfig, getMigrations } from 'src/common';
import * as path from 'path';

const getSemanticNameFromPath = (fullPath: string) => {
  let fileName = path.basename(fullPath).slice(15);
  fileName = fileName.split('.')[0];
  fileName = fileName
    .replace(/([A-Z]|-)/g, ' $1')
    .replaceAll('-', '')
    .toLocaleLowerCase();
  fileName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
  return fileName;
};

const formatMigrationListRow = (
  migrationItem: MigrationItem,
  direction: 'up' | 'down',
) => {
  const directionWithPadding = direction === 'down' ? '  down ' : '   up  ';
  return `${directionWithPadding}   ${
    migrationItem.version
  }   ${getSemanticNameFromPath(migrationItem.path)}`;
};

const migartionsLogger = <C extends ColumnTypesBase = DefaultColumnTypes>(
  config: RakeDbConfig<C>,
  direction: 'down' | 'up',
  migrationsList: MigrationItem[],
  printPath = false,
) => {
  // sorting the list based on the timestamp available in the filename.
  const sortedList = migrationsList.sort(
    (a, b) => Number(a.version) - Number(b.version),
  );

  sortedList.forEach((migrationItem) => {
    config.logger?.log(formatMigrationListRow(migrationItem, direction));
    if (printPath) {
      config.logger?.log(migrationItem.path);
      config.logger?.log('');
    }
  });
};

export const migrationList = async <
  C extends ColumnTypesBase = DefaultColumnTypes,
>(
  config: RakeDbConfig<C>,
  args: string[],
) => {
  config.logger?.log(' Status   Migration ID   Migration Name');
  config.logger?.log(''.padEnd(60, '-'));

  const printPath = args.includes('-p') || args.includes('--paths');
  // get list of down migrations & log them.
  const downMigrationsList = await getMigrations(config, false);
  migartionsLogger(config, 'down', downMigrationsList, printPath);

  // get list of up migrations & log them.
  const upMigrationsList = await getMigrations(config, true);
  migartionsLogger(config, 'up', upMigrationsList, printPath);
};
