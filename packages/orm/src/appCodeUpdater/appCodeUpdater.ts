import { AppCodeUpdater } from 'rake-db';
import * as path from 'path';
import { updateMainFile } from './updateMainFile';
import { updateTableFile } from './updateTableFile/updateTableFile';

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

  return async (ast) => {
    await Promise.all([
      updateMainFile(params.mainFilePath, params.tablePath, ast),
      updateTableFile({ ...params, ast }),
    ]);
  };
};
