import {
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  ForeignKeyModel,
  ForeignKeyOptions,
  getColumnTypes,
  getRaw,
  getTableData,
  IndexColumnOptions,
  IndexOptions,
  isRaw,
  quote,
  toArray,
  TransactionAdapter,
} from 'pqb';
import { joinColumns, joinWords } from '../common';

type TableOptions = { comment?: string };
type ColumnsShapeCallback = (t: ColumnTypes) => ColumnsShape;

export class Migration extends TransactionAdapter {
  constructor(tx: TransactionAdapter, public up: boolean) {
    super(tx.pool, tx.client, tx.types);
  }

  createTable(
    tableName: string,
    options: TableOptions,
    fn: ColumnsShapeCallback,
  ): Promise<void>;
  createTable(tableName: string, fn: ColumnsShapeCallback): Promise<void>;
  async createTable(
    tableName: string,
    cbOrOptions: ColumnsShapeCallback | TableOptions,
    cb?: ColumnsShapeCallback,
  ) {
    const options = typeof cbOrOptions === 'function' ? {} : cbOrOptions;
    const fn = (cb || cbOrOptions) as ColumnsShapeCallback;

    const shape = getColumnTypes(columnTypes, fn);

    if (!this.up) {
      await this.query(`DROP TABLE "${tableName}" CASCADE`);
      return;
    }

    const lines: string[] = [];
    const values: unknown[] = [];
    const indexes: { columns: IndexColumnOptions[]; options: IndexOptions }[] =
      [];
    const comments: { column: string; comment: string }[] = [];

    for (const key in shape) {
      const item = shape[key];
      const line = [`\n  "${key}" ${item.toSQL()}`];

      if (item.data.compression) {
        line.push(`COMPRESSION ${item.data.compression}`);
      }

      if (item.data.collate) {
        line.push(`COLLATE ${quote(item.data.collate)}`);
      }

      if (item.isPrimaryKey) {
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

      if (item.data)
        if (item.data.index) {
          indexes.push({
            columns: [{ ...item.data.index, column: key }],
            options: item.data.index,
          });
        }

      if (item.data.comment) {
        comments.push({ column: key, comment: item.data.comment });
      }

      lines.push(line.join(' '));
    }

    const tableData = getTableData();
    if (tableData.primaryKey) {
      lines.push(`\n  PRIMARY KEY (${joinColumns(tableData.primaryKey)})`);
    }

    tableData.foreignKeys.forEach((foreignKey) => {
      const table = getForeignKeyTable(foreignKey.fnOrTable);

      lines.push(
        `\n  CONSTRAINT "${
          foreignKey.options.name || joinWords(tableName)
        }" FOREIGN KEY (${joinColumns(foreignKey.columns)}) ${referencesToSql(
          table,
          foreignKey.foreignColumns,
          foreignKey.options,
        )}`,
      );
    });

    await this.query({
      text: `CREATE TABLE "${tableName}" (${lines.join(',')}\n)`,
      values,
    });

    indexes.push(...tableData.indexes);

    for (const { columns, options } of indexes) {
      const sql: string[] = ['CREATE'];

      if (options.unique) {
        sql.push('UNIQUE');
      }

      sql.push(
        `INDEX "${
          options.name ||
          joinWords(tableName, ...columns.map(({ column }) => column), 'index')
        }" ON "${tableName}"`,
      );

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

      await this.query(sql.join(' '));
    }

    for (const { column, comment } of comments) {
      await this.query(
        `COMMENT ON COLUMN "${tableName}"."${column}" IS ${quote(comment)}`,
      );
    }

    if (options.comment) {
      await this.query(
        `COMMENT ON TABLE "${tableName}" IS ${quote(options.comment)}`,
      );
    }
  }
}

const getForeignKeyTable = (fnOrTable: (() => ForeignKeyModel) | string) => {
  if (typeof fnOrTable === 'string') {
    return fnOrTable;
  }

  const klass = fnOrTable();
  return new klass().table;
};

const referencesToSql = (
  table: string,
  columns: string[],
  foreignKey: Pick<ForeignKeyOptions, 'match' | 'onDelete' | 'onUpdate'>,
) => {
  const sql: string[] = [`REFERENCES "${table}"(${joinColumns(columns)})`];

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
