import { AppCodeUpdater } from 'rake-db';
import * as path from 'path';
import { updateMainFile } from './updateMainFile';
import { updateTableFile } from './updateTableFile/updateTableFile';
import { createBaseTableFile } from './createBaseTableFile';
import { QueryLogOptions } from 'pqb';

export class AppCodeUpdaterError extends Error {}

export type AppCodeUpdaterConfig = {
  tablePath(tableName: string): string;
  mainFilePath: string;
  logger?: QueryLogOptions['logger'];
};

export type BaseTableParam = {
  filePath: string;
  name: string;
};

export const appCodeUpdater = ({
  tablePath,
  mainFilePath,
}: AppCodeUpdaterConfig): AppCodeUpdater => {
  return async ({
    ast,
    options,
    basePath,
    cache: cacheObject,
    logger,
    baseTable,
  }) => {
    const params: AppCodeUpdaterConfig = {
      tablePath(name: string) {
        const file = tablePath(name);
        return resolvePath(basePath, file);
      },
      mainFilePath: resolvePath(basePath, mainFilePath),
      logger,
    };

    const promises: Promise<void>[] = [
      updateMainFile(
        params.mainFilePath,
        params.tablePath,
        ast,
        options,
        logger,
      ),
      updateTableFile({ ...params, ast, baseTable }),
    ];

    const cache = cacheObject as { createdBaseTable?: true };
    if (!cache.createdBaseTable) {
      promises.push(
        createBaseTableFile({ logger: params.logger, baseTable }).then(() => {
          cache.createdBaseTable = true;
        }),
      );
    }

    await Promise.all(promises);
  };
};

const resolvePath = (basePath: string, filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
