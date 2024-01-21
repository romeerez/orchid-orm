import { DbMigration } from './migration';
import { RakeDbColumnTypes } from '../common';
import { ColumnSchemaConfig } from 'orchid-core';

let currentChanges: ChangeCallback<ColumnSchemaConfig, RakeDbColumnTypes>[] =
  [];

export type ChangeCallback<
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
> = (db: DbMigration<SchemaConfig, CT>, up: boolean) => Promise<void>;

export const clearChanges = () => {
  currentChanges = [];
};

export const getCurrentChanges = () => currentChanges;
export const pushChange = (
  fn: ChangeCallback<ColumnSchemaConfig, RakeDbColumnTypes>,
) => currentChanges.push(fn);
