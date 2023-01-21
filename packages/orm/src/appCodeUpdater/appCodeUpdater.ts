import { AppCodeUpdater } from 'rake-db';
// import * as path from 'path';

export class AppCodeUpdaterError extends Error {}

export type AppCodeUpdaterConfig = {
  tablePath(tableName: string): string;
  baseTablePath: string;
  baseTableName: string;
  mainFilePath: string;
};

export const appCodeUpdater = (): // config: AppCodeUpdaterConfig,
AppCodeUpdater => {
  // const tablePath = (name: string) => path.resolve(config.tablePath(name));
  // const mainFilePath = path.resolve(config.mainFilePath);

  return async (ast) => {
    console.log(ast);
  };
};
