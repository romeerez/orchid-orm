import { AppCodeUpdater } from 'rake-db';
import * as path from 'path';
import { updateMainFile } from './updateMainFile';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';
import { SetOptional } from 'pqb';

export class AppCodeUpdaterError extends Error {}

export type AppCodeUpdaterConfig = {
  tablePath(tableName: string): string;
  baseTablePath: string;
  baseTableName: string;
  mainFilePath: string;
};

export const appCodeUpdater = (
  config: SetOptional<AppCodeUpdaterConfig, 'baseTableName'>,
): AppCodeUpdater => {
  return async ({ ast, options, basePath, cache: cacheObject }) => {
    const params: AppCodeUpdaterConfig = {
      ...config,
      baseTableName: config.baseTableName || 'BaseTable',
      tablePath(name: string) {
        const file = config.tablePath(name);
        return path.isAbsolute(file) ? file : path.resolve(basePath, file);
      },
      mainFilePath: path.isAbsolute(config.mainFilePath)
        ? config.mainFilePath
        : path.resolve(basePath, config.mainFilePath),
    };

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
