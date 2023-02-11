import { EnumColumn, raw } from 'pqb';

export const tableMethods = {
  raw,
  enum: (name: string) =>
    // empty array will be filled during the migration by querying db
    new EnumColumn(name, [] as unknown as [string, ...string[]]),
};
