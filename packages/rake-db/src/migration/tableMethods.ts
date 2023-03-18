import { EnumColumn, UnknownColumn } from 'pqb';
import { ColumnTypesBase, RawExpression } from 'orchid-core';

export const tableMethods = {
  enum(this: ColumnTypesBase, name: string) {
    // empty array will be filled during the migration by querying db
    return new EnumColumn(this, name, [] as unknown as [string, ...string[]]);
  },
  check(this: ColumnTypesBase, value: RawExpression) {
    return new UnknownColumn(this).check(value);
  },
};
