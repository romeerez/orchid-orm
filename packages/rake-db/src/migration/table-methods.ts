import { EnumColumn, DefaultSchemaConfig } from 'pqb/internal';

export interface TableMethods {
  enum(
    name: string,
  ): EnumColumn<DefaultSchemaConfig, undefined, [string, ...string[]]>;
}

export const makeTableMethods = (
  schemaConfig: DefaultSchemaConfig,
): TableMethods => ({
  enum(name: string) {
    // empty array will be filled during the migration by querying db
    return new EnumColumn(
      schemaConfig,
      name,
      [] as unknown as [string, ...string[]],
      undefined,
    );
  },
});
