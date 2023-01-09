import {
  ColumnType,
  ForeignKeyModel,
  ForeignKeyOptions,
  getRaw,
  isRaw,
  quote,
  Sql,
  TableData,
  toArray,
} from 'pqb';
import { ColumnComment, Migration } from './migration';
import { joinColumns, joinWords, quoteTable } from '../common';

export const columnToSql = (
  key: string,
  item: ColumnType,
  values: unknown[],
  hasMultiplePrimaryKeys: boolean,
): string => {
  const line = [`"${key}" ${item.toSQL()}`];

  if (item.data.compression) {
    line.push(`COMPRESSION ${item.data.compression}`);
  }

  if (item.data.collate) {
    line.push(`COLLATE ${quote(item.data.collate)}`);
  }

  if (item.isPrimaryKey && !hasMultiplePrimaryKeys) {
    line.push('PRIMARY KEY');
  } else if (!item.isNullable) {
    line.push('NOT NULL');
  }

  if (item.data.default !== undefined) {
    if (
      typeof item.data.default === 'object' &&
      item.data.default &&
      isRaw(item.data.default)
    ) {
      line.push(`DEFAULT ${getRaw(item.data.default, values)}`);
    } else {
      line.push(`DEFAULT ${quote(item.data.default)}`);
    }
  }

  const { foreignKey } = item.data;
  if (foreignKey) {
    const table = getForeignKeyTable(
      'fn' in foreignKey ? foreignKey.fn : foreignKey.table,
    );

    if (foreignKey.name) {
      line.push(`CONSTRAINT "${foreignKey.name}"`);
    }

    line.push(referencesToSql(table, foreignKey.columns, foreignKey));
  }

  return line.join(' ');
};

export const addColumnIndex = (
  indexes: TableData.Index[],
  key: string,
  item: ColumnType,
) => {
  if (item.data) {
    if (item.data.index) {
      indexes.push({
        columns: [{ ...item.data.index, column: key }],
        options: item.data.index,
      });
    }
  }
};

export const addColumnComment = (
  comments: ColumnComment[],
  key: string,
  item: ColumnType,
) => {
  if (item.data.comment) {
    comments.push({ column: key, comment: item.data.comment });
  }
};

export const getForeignKeyTable = (
  fnOrTable: (() => ForeignKeyModel) | string,
) => {
  if (typeof fnOrTable === 'string') {
    return fnOrTable;
  }

  const klass = fnOrTable();
  return new klass().table;
};

export const constraintToSql = (
  tableName: string,
  up: boolean,
  foreignKey: TableData['foreignKeys'][number],
) => {
  const constraintName =
    foreignKey.options.name ||
    `${tableName}_${foreignKey.columns.join('_')}_fkey`;

  if (!up) {
    const { dropMode } = foreignKey.options;
    return `CONSTRAINT "${constraintName}"${dropMode ? ` ${dropMode}` : ''}`;
  }

  const table = getForeignKeyTable(foreignKey.fnOrTable);
  return `CONSTRAINT "${constraintName}" FOREIGN KEY (${joinColumns(
    foreignKey.columns,
  )}) ${referencesToSql(table, foreignKey.foreignColumns, foreignKey.options)}`;
};

export const referencesToSql = (
  table: string,
  columns: string[],
  foreignKey: Pick<ForeignKeyOptions, 'match' | 'onDelete' | 'onUpdate'>,
) => {
  const sql: string[] = [
    `REFERENCES ${quoteTable(table)}(${joinColumns(columns)})`,
  ];

  if (foreignKey.match) {
    sql.push(`MATCH ${foreignKey.match.toUpperCase()}`);
  }

  if (foreignKey.onDelete) {
    sql.push(`ON DELETE ${foreignKey.onDelete.toUpperCase()}`);
  }

  if (foreignKey.onUpdate) {
    sql.push(`ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`);
  }

  return sql.join(' ');
};

export const indexesToQuery = (
  up: boolean,
  tableName: string,
  indexes: TableData.Index[],
): Sql[] => {
  return indexes.map(({ columns, options }) => {
    const indexName =
      options.name ||
      joinWords(tableName, ...columns.map(({ column }) => column), 'index');

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

    sql.push(`INDEX "${indexName}" ON ${quoteTable(tableName)}`);

    if (options.using) {
      sql.push(`USING ${options.using}`);
    }

    const columnsSql: string[] = [];

    columns.forEach((column) => {
      const columnSql: string[] = [
        `"${column.column}"${
          column.expression ? `(${column.expression})` : ''
        }`,
      ];

      if (column.collate) {
        columnSql.push(`COLLATE '${column.collate}'`);
      }

      if (column.operator) {
        columnSql.push(column.operator);
      }

      if (column.order) {
        columnSql.push(column.order);
      }

      columnsSql.push(columnSql.join(' '));
    });

    sql.push(`(${columnsSql.join(', ')})`);

    if (options.include) {
      sql.push(
        `INCLUDE (${toArray(options.include)
          .map((column) => `"${column}"`)
          .join(', ')})`,
      );
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
          typeof options.where === 'object' &&
          options.where &&
          isRaw(options.where)
            ? getRaw(options.where, values)
            : options.where
        }`,
      );
    }

    return { text: sql.join(' '), values };
  });
};

export const commentsToQuery = (
  tableName: string,
  comments: ColumnComment[],
): Sql[] => {
  return comments.map(({ column, comment }) => ({
    text: `COMMENT ON COLUMN ${quoteTable(tableName)}."${column}" IS ${quote(
      comment,
    )}`,
    values: [],
  }));
};

export const primaryKeyToSql = (
  primaryKey: Exclude<TableData['primaryKey'], undefined>,
) => {
  const name = primaryKey.options?.name;
  return `${name ? `CONSTRAINT "${name}" ` : ''}PRIMARY KEY (${joinColumns(
    primaryKey.columns,
  )})`;
};

export const getPrimaryKeysOfTable = async (
  db: Migration,
  tableName: string,
): Promise<{ name: string; type: string }[]> => {
  const { rows } = await db.query<{ name: string; type: string }>(
    {
      text: `SELECT
  pg_attribute.attname AS name,
  format_type(pg_attribute.atttypid, pg_attribute.atttypmod) AS type
FROM pg_index, pg_class, pg_attribute, pg_namespace
WHERE
  pg_class.oid = $1::regclass AND
  indrelid = pg_class.oid AND
  nspname = 'public' AND
  pg_class.relnamespace = pg_namespace.oid AND
  pg_attribute.attrelid = pg_class.oid AND
  pg_attribute.attnum = any(pg_index.indkey) AND
  indisprimary`,
      values: [tableName],
    },
    db.types,
    undefined,
  );

  return rows;
};
