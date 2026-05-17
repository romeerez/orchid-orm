import { getSchemaAndTableFromName, quoteTable } from '../common';
import { Migration } from './migration';

const actionToSql = {
  enable: 'ENABLE ROW LEVEL SECURITY',
  disable: 'DISABLE ROW LEVEL SECURITY',
  force: 'FORCE ROW LEVEL SECURITY',
  noForce: 'NO FORCE ROW LEVEL SECURITY',
} as const;

type RlsAction = keyof typeof actionToSql;

const setRls = (
  migration: Migration,
  tableName: string,
  action: RlsAction,
): Promise<void> => {
  const [schema, table] = getSchemaAndTableFromName(
    migration.adapter.getSchema(),
    tableName,
  );

  return migration.adapter
    .query(`ALTER TABLE ${quoteTable(schema, table)} ${actionToSql[action]}`)
    .then(() => {});
};

export const enableOrDisableRls = (
  migration: Migration,
  up: boolean,
  tableName: string,
): Promise<void> => {
  return setRls(migration, tableName, up ? 'enable' : 'disable');
};

export const forceOrNoForceRls = (
  migration: Migration,
  up: boolean,
  tableName: string,
): Promise<void> => {
  return setRls(migration, tableName, up ? 'force' : 'noForce');
};
