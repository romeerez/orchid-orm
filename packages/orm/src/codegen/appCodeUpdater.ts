import { AppCodeUpdater } from 'rake-db';
import * as path from 'path';
import { updateMainFile } from './updateMainFile';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';

export class AppCodeUpdaterError extends Error {}

export type AppCodeUpdaterConfig = {
  tablePath(tableName: string): string;
  baseTablePath: string;
  baseTableName: string;
  mainFilePath: string;
};

export const appCodeUpdater = (
  config: AppCodeUpdaterConfig,
): AppCodeUpdater => {
  const params = {
    ...config,
    tablePath: (name: string) => path.resolve(config.tablePath(name)),
    mainFilePath: path.resolve(config.mainFilePath),
  };

  return async ({ ast, options, cache: cacheObject }) => {
    const promises: Promise<void>[] = [
      updateMainFile(params.mainFilePath, params.tablePath, ast, options),
      updateTableFile({ ...params, ast }),
    ];

    const cache = cacheObject as { createdBaseTable?: true };
    if (!cache.createdBaseTable) {
      promises.push(
        createBaseTableFile(params).then(() => {
          cache.createdBaseTable = true;
        }),
      );
    }

    await Promise.all(promises);
  };
};
