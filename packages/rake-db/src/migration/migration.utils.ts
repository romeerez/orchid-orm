import {
  ArrayColumn,
  Column,
  DomainColumn,
  escapeForMigration,
  isRawSQL,
  QuerySchema,
  RawSqlBase,
  SingleSql,
  TableData,
  toArray,
  toCamelCase,
  toSnakeCase,
} from 'pqb';
import { ColumnComment } from './migration';
import {
  getSchemaAndTableFromName,
  joinColumns,
  quoteCustomType,
  quoteNameFromString,
  quoteTable,
  quoteWithSchema,
} from '../common';
import { RakeDbConfig } from '../config';
import { TableQuery } from './create-table';

export const versionToString = (
  config: Pick<RakeDbConfig, 'migrationId'>,
  version: number,
) =>
  config.migrationId === 'timestamp'
    ? `${version}`
    : `${version}`.padStart(config.migrationId.serial, '0');

export const columnTypeToSql = (
  config: RakeDbConfig,
  item: Column.Pick.Data,
) => {
  return item.data.isOfCustomType
    ? item instanceof DomainColumn
      ? quoteNameFromString(config, item.dataType)
      : quoteCustomType(config, (item as Column).toSQL())
    : (item as Column).toSQL();
};

export const getColumnName = (
  item: { data: { name?: string } },
  key: string,
  snakeCase: boolean | undefined,
) => {
  return item.data.name || (snakeCase ? toSnakeCase(key) : key);
};

export const columnToSql = (
  config: RakeDbConfig,
  name: string,
  item: Column,
  values: unknown[],
  hasMultiplePrimaryKeys: boolean,
  snakeCase: boolean | undefined,
): string => {
  const line = [`"${name}" ${columnTypeToSql(config, item)}`];

  if (item.data.compression) {
    line.push(`COMPRESSION ${item.data.compression}`);
  }

  if (item.data.collate) {
    line.push(`COLLATE ${quoteNameFromString(config, item.data.collate)}`);
  }

  if (item.data.identity) {
    line.push(identityToSql(config, item.data.identity));
  } else if (item.data.generated) {
    line.push(
      `GENERATED ALWAYS AS (${item.data.generated.toSQL({
        values,
        snakeCase,
      })}) STORED`,
    );
  }

  if (item.data.primaryKey && !hasMultiplePrimaryKeys) {
    if (item.data.primaryKey !== (true as never)) {
      line.push(`CONSTRAINT "${item.data.primaryKey}"`);
    }
    line.push('PRIMARY KEY');
  } else if (!item.data.isNullable) {
    line.push('NOT NULL');
  }

  if (item.data.checks) {
    line.push(
      item.data.checks
        .map(
          (check) =>
            (check.name ? `CONSTRAINT "${check.name}" ` : '') +
            checkToSql(check.sql, values),
        )
        .join(', '),
    );
  }

  const def = encodeColumnDefault(item.data.default, values, item);
  if (def !== null) line.push(`DEFAULT ${def}`);

  const { foreignKeys } = item.data;
  if (foreignKeys) {
    for (const foreignKey of foreignKeys) {
      if (foreignKey.options?.name) {
        line.push(`CONSTRAINT "${foreignKey.options?.name}"`);
      }

      line.push(
        referencesToSql(
          config,
          {
            columns: [name],
            ...foreignKey,
          },
          snakeCase,
        ),
      );
    }
  }

  return line.join(' ');
};

export const encodeColumnDefault = (
  def: unknown,
  values: unknown[],
  column?: Column.Pick.Data,
): string | null => {
  if (def !== undefined && def !== null && typeof def !== 'function') {
    if (isRawSQL(def)) {
      return def.toSQL({ values });
    } else {
      return escapeForMigration(
        column instanceof ArrayColumn && Array.isArray(def)
          ? '{' +
              (column.data.item.data.encode
                ? def.map((x) => column.data.item.data.encode(x))
                : def
              ).join(',') +
              '}'
          : column?.data.encode
          ? column.data.encode(def)
          : def,
      );
    }
  }

  return null;
};

export const identityToSql = (
  config: RakeDbConfig,
  identity: TableData.Identity,
) => {
  const options = sequenceOptionsToSql(config, identity);
  return `GENERATED ${identity.always ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY${
    options ? ` (${options})` : ''
  }`;
};

const sequenceOptionsToSql = (
  config: RakeDbConfig,
  item: TableData.SequenceOptions,
) => {
  const line: string[] = [];
  if (item.dataType) line.push(`AS ${item.dataType}`);
  if (item.increment !== undefined) line.push(`INCREMENT BY ${item.increment}`);
  if (item.min !== undefined) line.push(`MINVALUE ${item.min}`);
  if (item.max !== undefined) line.push(`MAXVALUE ${item.max}`);
  if (item.start !== undefined) line.push(`START WITH ${item.start}`);
  if (item.cache !== undefined) line.push(`CACHE ${item.cache}`);
  if (item.cycle) line.push(`CYCLE`);
  if (item.ownedBy) {
    const [schema, table] = getSchemaAndTableFromName(config, item.ownedBy);
    line.push(`OWNED BY ${quoteTable(schema, table)}`);
  }
  return line.join(' ');
};

export const addColumnIndex = (
  indexes: TableData.Index[],
  name: string,
  item: Column,
) => {
  if (item.data.indexes) {
    indexes.push(
      ...item.data.indexes.map((index) => ({
        columns: [{ ...index.options, column: name }],
        ...index,
      })),
    );
  }
};

export const addColumnExclude = (
  excludes: TableData.Exclude[],
  name: string,
  item: Column,
) => {
  if (item.data.excludes) {
    excludes.push(
      ...item.data.excludes.map(({ with: w, ...exclude }) => ({
        columns: [{ ...exclude.options, column: name, with: w }],
        ...exclude,
      })),
    );
  }
};

export const addColumnComment = (
  comments: ColumnComment[],
  name: string,
  item: Column,
) => {
  if (item.data.comment) {
    comments.push({ column: name, comment: item.data.comment });
  }
};

export const getForeignKeyTable = (
  config: RakeDbConfig,
  fnOrTable: (() => Column.ForeignKey.TableParam) | string,
): [string | undefined, string] => {
  if (typeof fnOrTable === 'string') {
    return getSchemaAndTableFromName(config, fnOrTable);
  }

  const item = new (fnOrTable())();
  return [item.schema, item.table];
};

export const getConstraintName = (
  table: string,
  constraint: {
    references?: { columns: string[] };
    check?: unknown;
    identity?: unknown;
  },
  snakeCase: boolean | undefined,
) => {
  if (constraint.references) {
    let { columns } = constraint.references;
    if (snakeCase) {
      columns = columns.map(toSnakeCase);
    }
    return makeConstraintName(table, columns, 'fkey');
  }
  if (constraint.check) return `${table}_check`;
  if (constraint.identity) return `${table}_identity`;
  return `${table}_constraint`;
};

export const constraintToSql = (
  config: RakeDbConfig,
  { name }: { schema?: string; name: string },
  up: boolean,
  constraint: TableData.Constraint,
  values: unknown[],
  snakeCase: boolean | undefined,
) => {
  const constraintName =
    constraint.name || getConstraintName(name, constraint, snakeCase);

  if (!up) {
    const { dropMode } = constraint;
    return `CONSTRAINT "${constraintName}"${dropMode ? ` ${dropMode}` : ''}`;
  }

  const sql = [`CONSTRAINT "${constraintName}"`];

  if (constraint.references) {
    sql.push(foreignKeyToSql(config, constraint.references, snakeCase));
  }

  if (constraint.check) {
    sql.push(checkToSql(constraint.check, values));
  }

  return sql.join(' ');
};

const checkToSql = (check: RawSqlBase, values: unknown[]) => {
  return `CHECK (${check.toSQL({ values })})`;
};

const foreignKeyToSql = (
  config: RakeDbConfig,
  item: TableData.References,
  snakeCase?: boolean,
) => {
  return `FOREIGN KEY (${joinColumns(
    snakeCase ? item.columns.map(toSnakeCase) : item.columns,
  )}) ${referencesToSql(config, item, snakeCase)}`;
};

export const referencesToSql = (
  config: RakeDbConfig,
  references: TableData.References,
  snakeCase: boolean | undefined,
) => {
  const [schema, table] = getForeignKeyTable(config, references.fnOrTable);

  const sql: string[] = [
    `REFERENCES ${quoteTable(schema, table)}(${joinColumns(
      snakeCase
        ? references.foreignColumns.map(toSnakeCase)
        : references.foreignColumns,
    )})`,
  ];

  const { options } = references;
  if (options?.match) {
    sql.push(`MATCH ${options?.match.toUpperCase()}`);
  }

  if (options?.onDelete) {
    sql.push(`ON DELETE ${options?.onDelete.toUpperCase()}`);
  }

  if (options?.onUpdate) {
    sql.push(`ON UPDATE ${options?.onUpdate.toUpperCase()}`);
  }

  return sql.join(' ');
};

const MAX_CONSTRAINT_NAME_LEN = 63;
const makeConstraintName = (
  table: string,
  columns: string[],
  suffix: string,
) => {
  const long = `${table}_${columns.join('_')}_${suffix}`;
  if (long.length <= MAX_CONSTRAINT_NAME_LEN) return long;

  for (let partLen = 3; partLen > 0; partLen--) {
    const shorter = `${toCamelCase(
      toSnakeCase(table)
        .split('_')
        .map((p) => p.slice(0, partLen))
        .join('_'),
    )}_${columns
      .map((c) =>
        toCamelCase(
          c
            .split('_')
            .map((p) => p.slice(0, partLen))
            .join('_'),
        ),
      )
      .join('_')}_${suffix}`;

    if (shorter.length <= MAX_CONSTRAINT_NAME_LEN) return shorter;
  }

  const short = `${table}_${columns.length}columns_${suffix}`;
  if (short.length <= MAX_CONSTRAINT_NAME_LEN) return short;

  for (let partLen = 3; partLen > 0; partLen--) {
    const short = `${toCamelCase(
      toSnakeCase(table)
        .split('_')
        .map((p) => p.slice(0, partLen))
        .join('_'),
    )}_${columns.length}columns_${suffix}`;

    if (short.length <= MAX_CONSTRAINT_NAME_LEN) return short;
  }

  return `long_ass_table_${suffix}`;
};

const getIndexOrExcludeName = (
  table: string,
  columns: ({ column?: string } | { expression: string })[],
  suffix: string,
): string =>
  makeConstraintName(
    table,
    columns.map((it) =>
      'column' in it ? (it.column as string) : 'expression',
    ),
    suffix,
  );

export interface GetIndexOrExcludeName {
  (
    table: string,
    columns: ({ column?: string } | { expression: string })[],
  ): string;
}

export const getIndexName: GetIndexOrExcludeName = (table, columns) =>
  getIndexOrExcludeName(table, columns, 'idx');

export const getExcludeName: GetIndexOrExcludeName = (table, columns) =>
  getIndexOrExcludeName(table, columns, 'exclude');

export const indexesToQuery = (
  config: RakeDbConfig,
  up: boolean,
  { schema, name: tableName }: { schema?: string; name: string },
  indexes: TableData.Index[],
  snakeCase: boolean | undefined,
  language?: string,
): SingleSql[] => {
  return indexes.map((index) => {
    const { options } = index;

    const { columns, include, name } = getIndexOrExcludeMainOptions(
      tableName,
      index,
      getIndexName,
      snakeCase,
    );

    if (!up) {
      return {
        text: `DROP INDEX "${name}"${
          options.dropMode ? ` ${options.dropMode}` : ''
        }`,
      };
    }

    const values: unknown[] = [];

    const sql: string[] = ['CREATE'];

    if (options.unique) {
      sql.push('UNIQUE');
    }

    sql.push(`INDEX "${name}" ON ${quoteTable(schema, tableName)}`);

    const u = options.using || (options.tsVector && 'GIN');
    if (u) {
      sql.push(`USING ${u}`);
    }

    const lang =
      options.tsVector && options.languageColumn
        ? `"${options.languageColumn}"`
        : options.language
        ? `'${options.language}'`
        : `'${language || 'english'}'`;

    let hasWeight =
      options.tsVector && columns.some((column) => !!column.weight);

    const columnsSql = columns.map((column) => {
      let sql = [
        'expression' in column
          ? `(${column.expression})`
          : `"${column.column}"`,
        column.collate &&
          `COLLATE ${quoteNameFromString(config, column.collate)}`,
        column.opclass,
        column.order,
      ]
        .filter((x): x is string => !!x)
        .join(' ');

      if (hasWeight) {
        sql = `to_tsvector(${lang}, coalesce(${sql}, ''))`;

        if (column.weight) {
          hasWeight = true;
          sql = `setweight(${sql}, '${column.weight}')`;
        }
      }

      return sql;
    });

    let columnList;
    if (hasWeight) {
      columnList = `(${columnsSql.join(' || ')})`;
    } else if (options.tsVector) {
      columnList = `to_tsvector(${lang}, ${columnsSql.join(" || ' ' || ")})`;
    } else {
      columnList = columnsSql.join(', ');
    }

    sql.push(`(${columnList})`);

    if (include && include.length) {
      sql.push(
        `INCLUDE (${include.map((column) => `"${column}"`).join(', ')})`,
      );
    }

    if (options.nullsNotDistinct) {
      sql.push(`NULLS NOT DISTINCT`);
    }

    if (options.with) {
      sql.push(`WITH (${options.with})`);
    }

    if (options.tablespace) {
      sql.push(`TABLESPACE ${options.tablespace}`);
    }

    if (options.where) {
      sql.push(
        `WHERE ${
          isRawSQL(options.where)
            ? options.where.toSQL({ values })
            : options.where
        }`,
      );
    }

    return { text: sql.join(' '), values };
  });
};

export const excludesToQuery = (
  config: RakeDbConfig,
  up: boolean,
  { schema, name: tableName }: { schema?: string; name: string },
  excludes: TableData.Exclude[],
  snakeCase: boolean | undefined,
): SingleSql[] => {
  return excludes.map((exclude) => {
    const { options } = exclude;

    const { columns, include, name } = getIndexOrExcludeMainOptions(
      tableName,
      exclude,
      getExcludeName,
      snakeCase,
    );

    if (!up) {
      return {
        text: `ALTER TABLE ${quoteTable(
          schema,
          tableName,
        )} DROP CONSTRAINT "${name}"${
          options.dropMode ? ` ${options.dropMode}` : ''
        }`,
      };
    }

    const columnList = columns
      .map((column) =>
        [
          'expression' in column
            ? `(${column.expression})`
            : `"${column.column}"`,
          column.collate &&
            `COLLATE ${quoteNameFromString(config, column.collate)}`,
          column.opclass,
          column.order,
          `WITH ${column.with}`,
        ]
          .filter((x): x is string => !!x)
          .join(' '),
      )
      .join(', ');

    const values: unknown[] = [];

    const text = [
      `ALTER TABLE ${quoteTable(
        schema,
        tableName,
      )} ADD CONSTRAINT "${name}" EXCLUDE`,
      options.using && `USING ${options.using}`,
      `(${columnList})`,
      include?.length &&
        `INCLUDE (${include.map((column) => `"${column}"`).join(', ')})`,
      options.with && `WITH (${options.with})`,
      options.tablespace && `USING INDEX TABLESPACE ${options.tablespace}`,
      options.where &&
        `WHERE ${
          isRawSQL(options.where)
            ? options.where.toSQL({ values })
            : options.where
        }`,
    ]
      .filter((x): x is string => !!x)
      .join(' ');

    return { text, values };
  });
};

const getIndexOrExcludeMainOptions = <
  T extends TableData.Index | TableData.Exclude,
>(
  tableName: string,
  item: T,
  getName: GetIndexOrExcludeName,
  snakeCase?: boolean,
): { columns: T['columns']; include?: string[]; name: string } => {
  let include = item.options.include
    ? toArray(item.options.include)
    : undefined;

  let { columns } = item;
  if (snakeCase) {
    columns = columns.map((c) =>
      'column' in c ? { ...c, column: toSnakeCase(c.column) } : c,
    );
    if (include) include = include.map(toSnakeCase);
  }

  return {
    columns,
    include,
    name: item.options?.name || getName(tableName, columns),
  };
};

export const commentsToQuery = (
  schemaTable: { schema?: string; name: string },
  comments: ColumnComment[],
): SingleSql[] => {
  return comments.map(({ column, comment }) => ({
    text: `COMMENT ON COLUMN ${quoteWithSchema(
      schemaTable,
    )}."${column}" IS ${escapeForMigration(comment)}`,
    values: [],
  }));
};

export const primaryKeyToSql = (
  primaryKey: Exclude<TableData['primaryKey'], undefined>,
) => {
  return `${
    primaryKey.name ? `CONSTRAINT "${primaryKey.name}" ` : ''
  }PRIMARY KEY (${joinColumns(primaryKey.columns)})`;
};

export const interpolateSqlValues = ({ text, values }: TableQuery): string => {
  return values?.length
    ? text.replace(/\$(\d+)/g, (_, n) => {
        const i = +n - 1;
        return escapeForMigration(values[i]);
      })
    : text;
};

export interface ColumnNamedCheck extends Column.Data.Check {
  name: string;
}

export const nameColumnChecks = (
  table: string,
  column: string,
  checks: Column.Data.Check[],
): ColumnNamedCheck[] =>
  checks.map((check, i) => ({
    ...check,
    name: check.name || `${table}_${column}_check${i === 0 ? '' : i}`,
  }));

export const cmpRawSql = (a: RawSqlBase, b: RawSqlBase) => {
  const values: unknown[] = [];

  const aSql = a.makeSQL({ values });
  const aValues = JSON.stringify(values);

  values.length = 0;

  const bSql = b.makeSQL({ values });
  const bValues = JSON.stringify(values);

  return aSql === bSql && aValues === bValues;
};

export const getMigrationsSchemaAndTable = (config: {
  schema?: QuerySchema;
  migrationsTable: string;
}): {
  schema?: string;
  table: string;
} => {
  const [tableSchema, table] = getSchemaAndTableFromName(
    config,
    config.migrationsTable,
  );

  let schema = tableSchema;
  if (!schema) {
    schema =
      typeof config.schema === 'function' ? config.schema() : config.schema;

    if (schema === 'public') {
      schema = undefined;
    }
  }

  return { schema, table };
};

export const migrationsSchemaTableSql = (
  config: Pick<RakeDbConfig, 'migrationsTable'>,
) => {
  const { schema, table } = getMigrationsSchemaAndTable(config);
  return `${schema ? `"${schema}".` : ''}"${table}"`;
};
