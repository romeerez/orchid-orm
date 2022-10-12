import {
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  getColumnTypes,
  getRaw,
  getTableData,
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
    const indexes: { column: string; index: IndexOptions }[] = [];
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
        let table: string;
        if ('fn' in foreignKey) {
          const klass = foreignKey.fn();
          table = new klass().table;
        } else {
          table = foreignKey.table;
        }

        if (foreignKey.name) {
          line.push(`CONSTRAINT "${foreignKey.name}"`);
        }

        line.push(`REFERENCES "${table}"(${joinColumns(foreignKey.columns)})`);

        if (foreignKey.match) {
          line.push(`MATCH ${foreignKey.match.toUpperCase()}`);
        }

        if (foreignKey.onDelete) {
          line.push(`ON DELETE ${foreignKey.onDelete.toUpperCase()}`);
        }

        if (foreignKey.onUpdate) {
          line.push(`ON UPDATE ${foreignKey.onUpdate.toUpperCase()}`);
        }
      }

      if (item.data)
        if (item.data.index) {
          indexes.push({ column: key, index: item.data.index });
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

    await this.query({
      text: `CREATE TABLE "${tableName}" (${lines.join(',')}\n)`,
      values,
    });

    for (const { column, index } of indexes) {
      const sql: string[] = ['CREATE'];

      if (index.unique) {
        sql.push('UNIQUE');
      }

      sql.push(
        `INDEX "${
          index.name || joinWords(tableName, column, 'index')
        }" ON "${tableName}"`,
      );

      if (index.using) {
        sql.push(`USING ${index.using}`);
      }

      const columnSql: string[] = [
        `"${column}"${index.expression ? `(${index.expression})` : ''}`,
      ];

      if (index.collate) {
        columnSql.push(`COLLATE '${index.collate}'`);
      }

      if (index.operator) {
        columnSql.push(index.operator);
      }

      if (index.order) {
        columnSql.push(index.order);
      }

      sql.push(`(${columnSql.join(' ')})`);

      if (index.include) {
        sql.push(
          `INCLUDE (${toArray(index.include)
            .map((column) => `"${column}"`)
            .join(', ')})`,
        );
      }

      if (index.with) {
        sql.push(`WITH (${index.with})`);
      }

      if (index.tablespace) {
        sql.push(`TABLESPACE ${index.tablespace}`);
      }

      if (index.where) {
        sql.push(
          `WHERE ${
            typeof index.where === 'object' && index.where && isRaw(index.where)
              ? getRaw(index.where, values)
              : index.where
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
