import { ColumnType, quote, TableData } from 'pqb';
import {
  ColumnTypeBase,
  ForeignKeyTable,
  isRawSQL,
  RawSQLBase,
  Sql,
  toArray,
  toSnakeCase,
} from 'orchid-core';
import { ColumnComment } from './migration';
import {
  getSchemaAndTableFromName,
  joinColumns,
  quoteNameFromString,
  quoteTable,
  quoteWithSchema,
} from '../common';
import { AnyRakeDbConfig } from '../config';

export const versionToString = (config: AnyRakeDbConfig, version: number) =>
  config.migrationId === 'serial'
    ? `${version}`.padStart(4, '0')
    : `${version}`;

export const columnTypeToSql = (item: ColumnTypeBase) => {
  return item.data.isOfCustomType
    ? quoteNameFromString(item.toSQL())
    : item.toSQL();
};

export const getColumnName = (
  item: { data: { name?: string } },
  key: string,
  snakeCase: boolean | undefined,
) => {
  return item.data.name || (snakeCase ? toSnakeCase(key) : key);
};

export const columnToSql = (
  name: string,
  item: ColumnType,
  values: unknown[],
  hasMultiplePrimaryKeys: boolean,
  snakeCase: boolean | undefined,
): string => {
  const line = [`"${name}" ${columnTypeToSql(item)}`];

  if (item.data.compression) {
    line.push(`COMPRESSION ${item.data.compression}`);
  }

  if (item.data.collate) {
    line.push(`COLLATE ${quoteNameFromString(item.data.collate)}`);
  }

  if (item.data.identity) {
    line.push(identityToSql(item.data.identity));
  } else if (item.data.generated) {
    line.push(
      `GENERATED ALWAYS AS (${item.data.generated.toSQL({ values })}) STORED`,
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

  if (item.data.check) {
    line.push(checkToSql(item.data.check.sql, values));
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
  column?: ColumnTypeBase,
): string | null => {
  if (def !== undefined && def !== null && typeof def !== 'function') {
    if (isRawSQL(def)) {
      return def.toSQL({ values });
    } else {
      return quote(column?.encodeFn ? column.encodeFn(def) : def);
    }
  }

  return null;
};

export const identityToSql = (identity: TableData.Identity) => {
  const options = sequenceOptionsToSql(identity);
  return `GENERATED ${identity.always ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY${
    options ? ` (${options})` : ''
  }`;
};

const sequenceOptionsToSql = (item: TableData.SequenceOptions) => {
  const line: string[] = [];
  if (item.dataType) line.push(`AS ${item.dataType}`);
  if (item.increment !== undefined) line.push(`INCREMENT BY ${item.increment}`);
  if (item.min !== undefined) line.push(`MINVALUE ${item.min}`);
  if (item.max !== undefined) line.push(`MAXVALUE ${item.max}`);
  if (item.start !== undefined) line.push(`START WITH ${item.start}`);
  if (item.cache !== undefined) line.push(`CACHE ${item.cache}`);
  if (item.cycle) line.push(`CYCLE`);
  if (item.ownedBy) {
    const [schema, table] = getSchemaAndTableFromName(item.ownedBy);
    line.push(`OWNED BY ${quoteTable(schema, table)}`);
  }
  return line.join(' ');
};

export const addColumnIndex = (
  indexes: TableData.Index[],
  name: string,
  item: ColumnType,
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

export const addColumnComment = (
  comments: ColumnComment[],
  name: string,
  item: ColumnType,
) => {
  if (item.data.comment) {
    comments.push({ column: name, comment: item.data.comment });
  }
};

export const getForeignKeyTable = (
  fnOrTable: (() => ForeignKeyTable) | string,
): [string | undefined, string] => {
  if (typeof fnOrTable === 'string') {
    return getSchemaAndTableFromName(fnOrTable);
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
) => {
  if (constraint.references)
    return `${table}_${constraint.references.columns.join('_')}_fkey`;
  if (constraint.check) return `${table}_check`;
  if (constraint.identity) return `${table}_identity`;
  return `${table}_constraint`;
};

export const constraintToSql = (
  { name }: { schema?: string; name: string },
  up: boolean,
  constraint: TableData.Constraint,
  values: unknown[],
  snakeCase: boolean | undefined,
) => {
  const constraintName = constraint.name || getConstraintName(name, constraint);

  if (!up) {
    const { dropMode } = constraint;
    return `CONSTRAINT "${constraintName}"${dropMode ? ` ${dropMode}` : ''}`;
  }

  const sql = [`CONSTRAINT "${constraintName}"`];

  if (constraint.references) {
    sql.push(foreignKeyToSql(constraint.references, snakeCase));
  }

  if (constraint.check) {
    sql.push(checkToSql(constraint.check, values));
  }

  return sql.join(' ');
};

const checkToSql = (check: RawSQLBase, values: unknown[]) => {
  return `CHECK (${check.toSQL({ values })})`;
};

const foreignKeyToSql = (item: TableData.References, snakeCase?: boolean) => {
  return `FOREIGN KEY (${joinColumns(item.columns)}) ${referencesToSql(
    item,
    snakeCase,
  )}`;
};

export const referencesToSql = (
  references: TableData.References,
  snakeCase: boolean | undefined,
) => {
  const [schema, table] = getForeignKeyTable(references.fnOrTable);

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

export const getIndexName = (
  table: string,
  columns: ({ column?: string } | { expression: string })[],
) => {
  return `${table}_${columns
    .map((it) => ('column' in it ? it.column : 'expression'))
    .join('_')}_idx`;
};

export const indexesToQuery = (
  up: boolean,
  { schema, name: tableName }: { schema?: string; name: string },
  indexes: TableData.Index[],
  language?: string,
): Sql[] => {
  return indexes.map(({ columns, options, name }) => {
    const indexName = name || getIndexName(tableName, columns);

    if (!up) {
      return {
        text: `DROP INDEX "${indexName}"${
          options.dropMode ? ` ${options.dropMode}` : ''
        }`,
        values: [],
      };
    }

    const values: unknown[] = [];

    const sql: string[] = ['CREATE'];

    if (options.unique) {
      sql.push('UNIQUE');
    }

    sql.push(`INDEX "${indexName}" ON ${quoteTable(schema, tableName)}`);

    const u = options.using || (options.tsVector && 'GIN');
    if (u) {
      sql.push(`USING ${u}`);
    }

    const columnsSql: string[] = [];

    const lang =
      options.tsVector && options.languageColumn
        ? `"${options.languageColumn}"`
        : options.language
        ? `'${options.language}'`
        : `'${language || 'english'}'`;

    let hasWeight =
      options.tsVector && columns.some((column) => !!column.weight);

    for (const column of columns) {
      const columnSql: string[] = [
        'column' in column ? `"${column.column}"` : `(${column.expression})`,
      ];

      if (column.collate) {
        columnSql.push(`COLLATE ${quoteNameFromString(column.collate)}`);
      }

      if (column.opclass) {
        columnSql.push(column.opclass);
      }

      if (column.order) {
        columnSql.push(column.order);
      }

      let sql = columnSql.join(' ');

      if (hasWeight) {
        sql = `to_tsvector(${lang}, coalesce(${sql}, ''))`;

        if (column.weight) {
          hasWeight = true;
          sql = `setweight(${sql}, '${column.weight}')`;
        }
      }

      columnsSql.push(sql);
    }

    let columnList;
    if (hasWeight) {
      columnList = `(${columnsSql.join(' || ')})`;
    } else if (options.tsVector) {
      columnList = `to_tsvector(${lang}, ${columnsSql.join(" || ' ' || ")})`;
    } else {
      columnList = columnsSql.join(', ');
    }

    sql.push(`(${columnList})`);

    if (options.include) {
      sql.push(
        `INCLUDE (${toArray(options.include)
          .map((column) => `"${column}"`)
          .join(', ')})`,
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

export const commentsToQuery = (
  schemaTable: { schema?: string; name: string },
  comments: ColumnComment[],
): Sql[] => {
  return comments.map(({ column, comment }) => ({
    text: `COMMENT ON COLUMN ${quoteWithSchema(
      schemaTable,
    )}."${column}" IS ${quote(comment)}`,
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
