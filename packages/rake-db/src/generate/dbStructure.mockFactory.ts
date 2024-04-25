import { DbStructure } from './dbStructure';

const defaultTable: DbStructure.Table = {
  schemaName: 'public',
  name: 'table',
  columns: [],
};

const column: Omit<DbStructure.Column, 'type'> = {
  schemaName: 'public',
  tableName: 'table',
  name: 'column',
  typeSchema: 'pg_catalog',
  isArray: false,
  isNullable: false,
};

const intColumn: DbStructure.Column = {
  ...column,
  type: 'int4',
};

const textColumn: DbStructure.Column = {
  ...column,
  name: 'text',
  type: 'text',
};

const enumType: DbStructure.Enum = {
  schemaName: 'public',
  name: 'mood',
  values: ['sad', 'ok', 'happy'],
};

const enumColumn: DbStructure.Column = {
  ...column,
  typeSchema: enumType.schemaName,
  type: enumType.name,
};

const domain: DbStructure.Domain = {
  schemaName: 'public',
  name: 'domain',
  type: 'int4',
  typeSchema: 'pg_catalog',
  notNull: false,
  isArray: false,
};

const domainColumn: DbStructure.Column = {
  ...column,
  type: domain.name,
  typeSchema: domain.schemaName,
};

const timestampColumn: DbStructure.Column = {
  ...column,
  name: 'timestamp',
  type: 'timestamptz',
  dateTimePrecision: 6,
};

const createdAtColumn: DbStructure.Column = {
  ...timestampColumn,
  name: 'createdAt',
  dateTimePrecision: 6,
  default: 'now()',
};

const updatedAtColumn: DbStructure.Column = {
  ...createdAtColumn,
  name: 'updatedAt',
};

const varcharColumn: DbStructure.Column = {
  ...column,
  name: 'varchar',
  type: 'character varying',
  maxChars: 255,
};

const decimalColumn: DbStructure.Column = {
  ...column,
  name: 'decimal',
  type: 'decimal',
  numericPrecision: 10,
  numericScale: 2,
};

const identityColumn: DbStructure.Column = {
  ...column,
  name: 'identity',
  type: 'integer',
  identity: {
    always: false,
    start: 1,
    increment: 1,
    cache: 1,
    cycle: false,
  },
};

const idColumn: DbStructure.Column = {
  ...intColumn,
  name: 'id',
  default: `nextval('table_id_seq'::regclass)`,
};

const check: DbStructure.Constraint & { check: DbStructure.Check } = {
  schemaName: 'public',
  tableName: 'table',
  name: 'table_column_check',
  check: {
    columns: ['column'],
    expression: 'column > 10',
  },
};

const primaryKey: DbStructure.Constraint = {
  schemaName: 'public',
  tableName: 'table',
  name: 'table_pkey',
  primaryKey: ['id'],
};

const foreignKey: DbStructure.Constraint & {
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
    match: 's',
    onUpdate: 'a',
    onDelete: 'a',
  },
};

const index: DbStructure.Index = {
  schemaName: 'public',
  tableName: 'table',
  name: 'index',
  using: 'btree',
  unique: false,
  columns: [{ column: 'name' }],
};

const extension: DbStructure.Extension = {
  schemaName: 'public',
  name: 'name',
  version: '123',
};

const collation: DbStructure.Collation = {
  schemaName: 'public',
  name: 'collation',
  provider: 'icu',
  deterministic: true,
  locale: 'locale',
  version: '123',
};

const view: DbStructure.View = {
  schemaName: 'custom',
  name: 'view',
  isRecursive: true,
  with: [
    'check_option=LOCAL',
    'security_barrier=true',
    'security_invoker=true',
  ],
  columns: [intColumn],
  sql: 'sql',
  deps: [],
};

const columns = [
  { ...intColumn, name: 'id' },
  { ...textColumn, name: 'name' },
];

export const dbStructureMockFactory = {
  table: (data: Partial<DbStructure.Table> = {}): DbStructure.Table => {
    const schemaName = data.schemaName ?? defaultTable.schemaName;
    const tableName = data.name ?? defaultTable.name;

    return {
      ...defaultTable,
      ...data,
      columns: (data.columns ?? defaultTable.columns).map((column) => ({
        ...column,
        schemaName,
        tableName,
      })),
    };
  },
  tableWithColumns: (
    data: Partial<DbStructure.Table> = {},
  ): DbStructure.Table =>
    dbStructureMockFactory.table({
      ...data,
      columns,
    }),
  column: (
    data: Partial<DbStructure.Column> & { type: string },
  ): DbStructure.Column => ({
    ...column,
    ...data,
  }),
  intColumn: (data: Partial<DbStructure.Column> = {}): DbStructure.Column => ({
    ...intColumn,
    ...data,
  }),
  textColumn: (data: Partial<DbStructure.Column> = {}): DbStructure.Column => ({
    ...textColumn,
    ...data,
  }),
  enumColumn: (data: Partial<DbStructure.Column> = {}): DbStructure.Column => ({
    ...enumColumn,
    ...data,
  }),
  enum: (data: Partial<DbStructure.Enum> = {}): DbStructure.Enum => ({
    ...enumType,
    ...data,
  }),
  domainColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...domainColumn,
    ...data,
  }),
  domain: (data: Partial<DbStructure.Domain> = {}): DbStructure.Domain => ({
    ...domain,
    ...data,
  }),
  timestampColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...timestampColumn,
    ...data,
  }),
  createdAtColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...createdAtColumn,
    ...data,
  }),
  updatedAtColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...updatedAtColumn,
    ...data,
  }),
  varcharColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...varcharColumn,
    ...data,
  }),
  decimalColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...decimalColumn,
    ...data,
  }),
  identityColumn: (
    data: Partial<DbStructure.Column> = {},
  ): DbStructure.Column => ({
    ...identityColumn,
    ...data,
  }),
  idColumn: (data: Partial<DbStructure.Column> = {}): DbStructure.Column => ({
    ...idColumn,
    ...data,
  }),
  check: (
    data: Partial<DbStructure.Constraint> = {},
  ): DbStructure.Constraint & { check: DbStructure.Check } => ({
    ...check,
    ...data,
  }),
  primaryKey: (
    data: Partial<DbStructure.Constraint> = {},
  ): DbStructure.Constraint => ({
    ...primaryKey,
    name:
      data.name ?? data.tableName ? `${data.tableName}_pkey` : primaryKey.name,
    ...data,
  }),
  foreignKey: (
    from: string,
    to: string,
    data: Omit<Partial<DbStructure.Constraint>, 'references'> & {
      references?: Partial<DbStructure.Constraint['references']>;
    } = {},
  ): DbStructure.Constraint & {
    references: DbStructure.References;
  } => ({
    ...foreignKey,
    ...data,
    tableName: from,
    references: {
      ...foreignKey.references,
      ...data.references,
      foreignTable: to,
    },
  }),
  constraints: (
    {
      schemaName = defaultTable.schemaName,
      tableName = defaultTable.name,
    }: Partial<Pick<DbStructure.Constraint, 'schemaName' | 'tableName'>>,
    constraints: DbStructure.Constraint[],
  ): DbStructure.Constraint[] =>
    constraints.map((constraint) => ({
      ...constraint,
      schemaName,
      tableName,
    })),
  index: (data: Partial<DbStructure.Index> = {}): DbStructure.Index => ({
    ...index,
    ...data,
  }),
  extension: (
    data: Partial<DbStructure.Extension> = {},
  ): DbStructure.Extension => ({
    ...extension,
    ...data,
  }),
  collation: (
    data: Partial<DbStructure.Collation> = {},
  ): DbStructure.Collation => ({
    ...collation,
    ...data,
  }),
  view: (data: Partial<DbStructure.View> = {}): DbStructure.View => ({
    ...view,
    ...data,
  }),
};
