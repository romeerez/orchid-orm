import { DbStructure } from './dbStructure';

export const table: DbStructure.Table = {
  schemaName: 'public',
  name: 'table',
};

export const column: Omit<DbStructure.Column, 'type'> = {
  schemaName: 'public',
  tableName: 'table',
  name: 'column',
  typeSchema: 'pg_catalog',
  isArray: false,
  isNullable: false,
};

export const intColumn: DbStructure.Column = {
  schemaName: 'public',
  tableName: 'table',
  name: 'column',
  typeSchema: 'pg_catalog',
  type: 'int4',
  isArray: false,
  default: '123',
  isNullable: false,
};

export const identityColumn: DbStructure.Column = {
  ...column,
  name: 'identity',
  type: 'integer',
  identity: {
    always: false,
  },
};

export const idColumn: DbStructure.Column = {
  ...intColumn,
  name: 'id',
  default: `nextval('table_id_seq'::regclass)`,
};

export const textColumn: DbStructure.Column = {
  ...column,
  name: 'text',
  type: 'text',
  isArray: false,
};

export const varCharColumn: DbStructure.Column = {
  ...intColumn,
  name: 'varchar',
  type: 'character varying',
  collation: 'en_US',
  maxChars: 10,
};

export const decimalColumn: DbStructure.Column = {
  ...intColumn,
  name: 'decimal',
  type: 'decimal',
  numericPrecision: 10,
  numericScale: 2,
};

export const timestampColumn: DbStructure.Column = {
  ...intColumn,
  name: 'timestamp',
  type: 'timestamp',
  dateTimePrecision: 10,
};

export const createdAtColumn: DbStructure.Column = {
  ...timestampColumn,
  name: 'createdAt',
  dateTimePrecision: 6,
  default: 'now()',
};

export const updatedAtColumn: DbStructure.Column = {
  ...createdAtColumn,
  name: 'updatedAt',
};

export const index: DbStructure.Index = {
  schemaName: 'public',
  tableName: 'table',
  name: 'index',
  using: 'btree',
  isUnique: false,
  columns: [{ column: 'name' }],
};

export const foreignKey: DbStructure.Constraint & {
  references: DbStructure.References;
} = {
  schemaName: 'public',
  tableName: 'table',
  name: 'fkey',
  references: {
    foreignSchema: 'public',
    foreignTable: 'otherTable',
    columns: ['otherId'],
    foreignColumns: ['id'],
    match: 'f',
    onUpdate: 'c',
    onDelete: 'c',
  },
};

export const extension: DbStructure.Extension = {
  schemaName: 'public',
  name: 'name',
  version: '123',
};

export const enumType: DbStructure.Enum = {
  schemaName: 'public',
  name: 'mood',
  values: ['sad', 'ok', 'happy'],
};

export const primaryKey: DbStructure.Constraint = {
  schemaName: 'public',
  tableName: 'table',
  name: 'pkey',
  primaryKey: ['id'],
};

export const check: DbStructure.Constraint & { check: DbStructure.Check } = {
  schemaName: 'public',
  tableName: 'table',
  name: 'table_column_check',
  check: {
    columns: ['column'],
    expression: 'column > 10',
  },
};

export const domain: DbStructure.Domain = {
  schemaName: 'public',
  name: 'domain',
  type: 'int4',
  typeSchema: 'pg_catalog',
  notNull: false,
  isArray: false,
};
