import { Query } from '../query/query';
import {
  ColumnDataBase,
  ColumnNameOfTable,
  ColumnTypeBase,
  ColumnTypeSchemaArg,
  emptyObject,
  ForeignKeyTable,
  PickColumnBaseData,
  PrimaryKeyColumn,
  pushColumnData,
  QueryBaseCommon,
  RawSQLValues,
  setColumnData,
  StaticSQLArgs,
  TemplateLiteralArgs,
  templateLiteralSQLToCode,
  UniqueColumn,
} from 'orchid-core';
import { raw } from '../sql/rawSql';
import { TableData } from '../tableData';

// type of data for ColumnType
export interface ColumnData extends ColumnDataBase {
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  validationDefault?: unknown;
  indexes?: TableData.ColumnIndex[];
  comment?: string;
  collate?: string;
  compression?: string;
  foreignKeys?: TableData.ColumnReferences[];
  identity?: TableData.Identity;
  // raw SQL for generated columns
  generated?: ColumnDataGenerated;
}

export interface ColumnDataGenerated {
  toSQL(
    ctx: { values: unknown[]; snakeCase: boolean | undefined },
    quotedAs?: string,
  ): string;

  toCode(): string;
}

export interface ColumnFromDbParams {
  isNullable?: boolean;
  default?: string;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  compression?: string;
  collate?: string;
  extension?: string;
  typmod: number;
}

export interface PickColumnData {
  data: ColumnData;
}

export abstract class ColumnType<
  Schema extends ColumnTypeSchemaArg = ColumnTypeSchemaArg,
  Type = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputSchema = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ops = any,
  InputType = Type,
  OutputType = Type,
  OutputSchema = InputSchema,
  QueryType = InputType,
  QuerySchema = InputSchema,
> extends ColumnTypeBase<
  Schema,
  Type,
  InputSchema,
  Ops,
  InputType,
  OutputType,
  OutputSchema,
  QueryType,
  QuerySchema,
  ColumnData
> {
  /**
   * Mark the column as a primary key.
   * This column type becomes an argument of the `.find` method.
   * So if the primary key is of `integer` type (`identity` or `serial`), `.find` will accept the number,
   * or if the primary key is of `UUID` type, `.find` will expect a string.
   *
   * Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     id: t.uuid().primaryKey(),
   *     // database-level name can be passed:
   *     id: t.uuid().primaryKey('primary_key_name'),
   *   }));
   * }
   *
   * // primary key can be used by `find` later:
   * db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
   * ```
   *
   * @param name - to specify a constraint name
   */
  primaryKey<T extends PickColumnBaseData, Name extends string>(
    this: T,
    name?: Name,
  ): PrimaryKeyColumn<T, Name> {
    return setColumnData(this, 'primaryKey', name ?? (true as never)) as never;
  }

  /**
   * Defines a reference between different tables to enforce data integrity.
   *
   * In [snakeCase](/guide/orm-and-query-builder.html#snakecase-option) mode, columns of both tables are translated to a snake_case.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     otherId: t.integer().foreignKey('otherTableName', 'columnName'),
   *   }));
   * });
   * ```
   *
   * In the migration it's different from OrchidORM table code where a callback with a table is expected:
   *
   * ```ts
   * export class SomeTable extends BaseTable {
   *   readonly table = 'someTable';
   *   columns = this.setColumns((t) => ({
   *     otherTableId: t.integer().foreignKey(() => OtherTable, 'id'),
   *   }));
   * }
   * ```
   *
   * Optionally you can pass the third argument to `foreignKey` with options:
   *
   * ```ts
   * type ForeignKeyOptions = {
   *   // name of the constraint
   *   name?: string;
   *   // see database docs for MATCH in FOREIGN KEY
   *   match?: 'FULL' | 'PARTIAL' | 'SIMPLE';
   *
   *   onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   *   onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
   * };
   * ```
   *
   * ## composite foreign key
   *
   * Set foreign key from multiple columns in the current table to corresponding columns in the other table.
   *
   * The first argument is an array of columns in the current table, the second argument is another table name, the third argument is an array of columns in another table, and the fourth argument is for options.
   *
   * Options are the same as in a single-column foreign key.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.integer(),
   *     name: t.string(), // string is varchar(255)
   *     ...t.foreignKey(
   *       ['id', 'name'],
   *       'otherTable',
   *       ['foreignId', 'foreignName'],
   *       {
   *         name: 'constraintName',
   *         match: 'FULL',
   *         onUpdate: 'RESTRICT',
   *         onDelete: 'CASCADE',
   *       },
   *     ),
   *   }));
   * });
   * ```
   *
   * @param fn - function returning a table class
   * @param column - column in the foreign table to connect with
   * @param options - {@link ForeignKeyOptions}
   */
  foreignKey<
    T,
    Table extends ForeignKeyTable,
    Column extends ColumnNameOfTable<Table>,
  >(
    this: T,
    fn: () => Table,
    column: Column,
    options?: TableData.References.Options,
  ): T;
  foreignKey<T, Table extends string, Column extends string>(
    this: T,
    table: Table,
    column: Column,
    options?: TableData.References.Options,
  ): T;
  foreignKey(
    fnOrTable: TableData.References.FnOrTable,
    column: string,
    options: TableData.References.Options = emptyObject,
  ) {
    return pushColumnData(this, 'foreignKeys', {
      fnOrTable,
      foreignColumns: [column],
      options,
    });
  }

  toSQL(): string {
    return this.dataType;
  }

  /**
   * Add an index to the column.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     // add an index to the name column with default settings:
   *     name: t.text().index(),
   *     // options are described below:
   *     name: t.text().index({ ...options }),
   *     // with a database-level name:
   *     name: t.text().index('custom_index_name'),
   *     // with name and options:
   *     name: t.text().index('custom_index_name', { ...options }),
   *   }));
   * });
   * ```
   *
   * Possible options are:
   *
   * ```ts
   * type IndexOptions = {
   *   // NULLS NOT DISTINCT: availabe in Postgres 15+, makes sense only for unique index
   *   nullsNotDistinct?: true;
   *   // index algorithm to use such as GIST, GIN
   *   using?: string;
   *   // specify collation:
   *   collate?: string;
   *   // see `opclass` in the Postgres document for creating the index
   *   opclass?: string;
   *   // specify index order such as ASC NULLS FIRST, DESC NULLS LAST
   *   order?: string;
   *   // include columns to an index to optimize specific queries
   *   include?: MaybeArray<string>;
   *   // see "storage parameters" in the Postgres document for creating an index, for example, 'fillfactor = 70'
   *   with?: string;
   *   // The tablespace in which to create the index. If not specified, default_tablespace is consulted, or temp_tablespaces for indexes on temporary tables.
   *   tablespace?: string;
   *   // WHERE clause to filter records for the index
   *   where?: string;
   *   // mode is for dropping the index
   *   mode?: 'CASCADE' | 'RESTRICT';
   * };
   * ```
   *
   * @param args
   */
  index<T extends PickColumnData>(
    this: T,
    ...args:
      | [options?: TableData.Index.ColumnArg]
      | [name: string, options?: TableData.Index.ColumnArg]
  ): T {
    return pushColumnData(this, 'indexes', {
      options: (typeof args[0] === 'string' ? args[1] : args[0]) ?? emptyObject,
      name: typeof args[0] === 'string' ? args[0] : undefined,
    });
  }

  /**
   * `searchIndex` is designed for [full text search](/guide/text-search).
   *
   * It can accept the same options as a regular `index`, but it is `USING GIN` by default, and it is concatenating columns into a `tsvector` database type.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body']),
   *   }));
   * });
   * ```
   *
   * Produces the following index ('english' is a default language, see [full text search](/guide/text-search.html#language) for changing it):
   *
   * ```sql
   * CREATE INDEX "table_title_body_idx" ON "table" USING GIN (to_tsvector('english', "title" || ' ' || "body"))
   * ```
   *
   * You can set different search weights (`A` to `D`) on different columns inside the index:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex([
   *       { column: 'title', weight: 'A' },
   *       { column: 'body', weight: 'B' },
   *     ]),
   *   }));
   * });
   * ```
   *
   * When the table has localized columns,
   * you can define different indexes for different languages by setting the `language` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     titleEn: t.text(),
   *     bodyEn: t.text(),
   *     titleFr: t.text(),
   *     bodyFr: t.text(),
   *     ...t.searchIndex(['titleEn', 'bodyEn'], { language: 'english' }),
   *     ...t.searchIndex(['titleFr', 'bodyFr'], { language: 'french' }),
   *   }));
   * });
   * ```
   *
   * Alternatively, different table records may correspond to a single language,
   * then you can define a search index that relies on a language column by using `languageColumn` parameter:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     lang: t.type('regconfig'),
   *     title: t.text(),
   *     body: t.text(),
   *     ...t.searchIndex(['title', 'body'], { languageColumn: 'lang' }),
   *   }));
   * });
   * ```
   *
   * It can be more efficient to use a [generated](/guide/migration-column-methods.html#generated-column) column instead of indexing text column in the way described above,
   * and to set a `searchIndex` on it:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     id: t.identity().primaryKey(),
   *     title: t.text(),
   *     body: t.text(),
   *     generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
   *   }));
   * });
   * ```
   *
   * Produces the following index:
   *
   * ```sql
   * CREATE INDEX "table_generatedTsVector_idx" ON "table" USING GIN ("generatedTsVector")
   * ```
   *
   * @param options - index options
   */
  searchIndex<T extends { data: ColumnType['data']; dataType: string }>(
    this: T,
    ...args:
      | [options?: TableData.Index.TsVectorColumnArg]
      | [name: string, options?: TableData.Index.TsVectorColumnArg]
  ): T {
    return pushColumnData(this, 'indexes', {
      options: {
        ...(typeof args[0] === 'string' ? args[1] : args[0]),
        ...(this.dataType === 'tsvector'
          ? { using: 'GIN' }
          : { tsVector: true }),
      },
      name: typeof args[0] === 'string' ? args[0] : undefined,
    });
  }

  unique<T extends PickColumnData, Name extends string>(
    this: T,
    ...args:
      | [options?: TableData.Index.UniqueColumnArg]
      | [name: Name, options?: TableData.Index.UniqueColumnArg]
  ): UniqueColumn<T, Name> {
    return pushColumnData(this, 'indexes', {
      options: {
        ...(typeof args[0] === 'string' ? args[1] : args[0]),
        unique: true,
      },
      name: typeof args[0] === 'string' ? args[0] : undefined,
    }) as never;
  }

  comment<T extends PickColumnData>(this: T, comment: string): T {
    return setColumnData(this, 'comment', comment);
  }

  compression<T extends PickColumnData>(this: T, compression: string): T {
    return setColumnData(this, 'compression', compression);
  }

  collate<T extends PickColumnData>(this: T, collate: string): T {
    return setColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends PickColumnData>(this: T, cb: (q: Query) => void): T {
    return setColumnData(
      this,
      'modifyQuery',
      cb as (q: QueryBaseCommon) => void,
    );
  }

  /**
   * Define a generated column. `generated` accepts a raw SQL.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     two: t.integer().generated`1 + 1`,
   *   }));
   * });
   * ```
   *
   * @param args - raw SQL
   */
  generated<T extends PickColumnData>(this: T, ...args: StaticSQLArgs): T {
    const sql = raw(...args);
    return setColumnData(this, 'generated', {
      toSQL(ctx, quoted) {
        return sql.toSQL(ctx, quoted);
      },

      toCode() {
        let sql = '.generated';

        if (Array.isArray(args[0])) {
          sql += templateLiteralSQLToCode(args as TemplateLiteralArgs);
        } else {
          const { raw, values } = args[0] as {
            raw: string;
            values?: RawSQLValues;
          };
          sql += `({ raw: '${raw.replace(/'/g, "\\'")}'${
            values ? `, values: ${JSON.stringify(values)}` : ''
          } })`;
        }

        return sql;
      },
    });
  }
}
