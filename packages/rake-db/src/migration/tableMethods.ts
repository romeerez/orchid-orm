import { EnumColumn } from 'pqb';

export const tableMethods = {
  enum: (name: string) =>
    // empty array will be filled during the migration by querying db
    new EnumColumn(name, [] as unknown as [string, ...string[]]),
};
