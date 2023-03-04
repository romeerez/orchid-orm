import { ColumnTypesBase, EnumColumn } from 'pqb';

export const tableMethods = {
  enum(this: ColumnTypesBase, name: string) {
    // empty array will be filled during the migration by querying db
    return new EnumColumn(this, name, [] as unknown as [string, ...string[]]);
  },
};
