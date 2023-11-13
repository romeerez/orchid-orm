export type UserProvidedConfig = {
  path: string;
  testDatabase?: boolean;
  addSchemaToZod?: boolean;
  addTestFactory?: boolean;
  demoTables?: boolean;
  timestamp?: 'string' | 'date' | 'number';
  runner: 'tsx' | 'vite-node' | 'bun' | 'ts-node';
};

export type InitConfig = UserProvidedConfig & {
  hasTsConfig: boolean;
  dbDirPath: string;
  projectName: string;
  esm: boolean;
};

export { getConfig } from './lib/getConfig';
export { init } from './lib/init';
export { greetAfterInstall } from './lib/greetAfterInstall';
