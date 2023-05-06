import {
  ColumnsShape,
  columnTypes as defaultColumnTypes,
  Db,
  DefaultColumnTypes,
  getColumnTypes,
  Query,
} from 'pqb';
import {
  ColumnShapeOutput,
  ColumnTypesBase,
  getCallerFilePath,
  snakeCaseKey,
  StringKey,
  toSnakeCase,
} from 'orchid-core';
import { MapRelations, Relation, RelationThunks } from './relations/relations';
import { OrchidORM } from './orm';

// type of table class itself
export type TableClass<T extends Table = Table> = new () => T;

// object with table classes, used on orchidORM() for setting tables
export type TableClasses = Record<string, TableClass>;

// convert table instance type to queryable interface
// processes relations to a type that's understandable by `pqb`
// add ORM table specific metadata like `definedAt`, `db`, `filePath`
export type TableToDb<T extends Table> = Db<
  T['table'],
  T['columns']['shape'],
  'relations' extends keyof T
    ? T['relations'] extends RelationThunks
      ? {
          [K in StringKey<keyof T['relations']>]: Relation<
            T,
            T['relations'],
            K
          >;
        }
      : Query['relations']
    : Query['relations'],
  T['columnTypes']
> & { definedAs: string; db: OrchidORM; filePath: string; name: string };

// convert a table class type into queryable interface
// add relation methods
export type DbTable<T extends TableClass> = TableToDb<InstanceType<T>> &
  Omit<MapRelations<InstanceType<T>>, keyof Query>;

// `columns` property of table has a shape and an output type of the columns
type ColumnsConfig = {
  shape: ColumnsShape;
  type: unknown;
};

// callback with a query of relation, to use as a default scope
type ScopeFn<Related extends TableClass, Scope extends Query> = (
  q: DbTable<Related>,
) => Scope;

// type of table instance created by a table class
export type Table = {
  table: string;
  columns: ColumnsConfig;
  schema?: string;
  columnTypes: ColumnTypesBase;
  noPrimaryKey?: boolean;
  filePath: string;
};

// base table constructor
export const createBaseTable = <CT extends ColumnTypesBase>(
  {
    columnTypes,
    snakeCase,
    filePath,
    nowSQL,
  }: {
    // concrete column types or a callback for overriding standard column types
    // this types will be used in tables to define their columns
    columnTypes?: CT | ((t: DefaultColumnTypes) => CT);
    // when set to true, all columns will be translated to `snake_case` when querying database
    snakeCase?: boolean;
    // if for some unknown reason you see error that file path for a table can't be guessed automatically,
    // provide it manually via `filePath`
    filePath?: string;
    // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
    nowSQL?: string;
  } = { columnTypes: defaultColumnTypes as unknown as CT },
) => {
  const ct =
    typeof columnTypes === 'function'
      ? columnTypes(defaultColumnTypes)
      : columnTypes || defaultColumnTypes;

  filePath ??= getCallerFilePath();
  if (!filePath) {
    throw new Error(
      `Failed to determine file path of a base table. Please set the \`filePath\` option of \`createBaseTable\` manually.`,
    );
  }

  return create(
    ct as ColumnTypesBase extends CT ? DefaultColumnTypes : CT,
    filePath,
    snakeCase,
    nowSQL,
  );
};

const create = <CT extends ColumnTypesBase>(
  columnTypes: CT,
  filePath: string,
  snakeCase?: boolean,
  nowSQL?: string,
) => {
  const base = class BaseTable {
    static filePath = filePath;
    static nowSQL = nowSQL;

    table!: string;
    columns!: ColumnsConfig;
    schema?: string;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    columnTypes: CT;
    filePath!: string;

    constructor() {
      this.columnTypes = columnTypes;
    }

    setColumns<T extends ColumnsShape>(
      fn: (t: CT) => T,
    ): { shape: T; type: ColumnShapeOutput<T> } {
      if (!this.filePath) {
        const filePath = getCallerFilePath();
        if (!filePath) {
          throw new Error(
            `Failed to determine file path for table ${this.constructor.name}. Please set \`filePath\` property manually`,
          );
        }

        this.filePath = filePath;
      }

      (columnTypes as { [snakeCaseKey]?: boolean })[snakeCaseKey] =
        this.snakeCase;

      const shape = getColumnTypes(columnTypes, fn, nowSQL);

      if (this.snakeCase) {
        for (const key in shape) {
          const column = shape[key];
          if (column.data.name) continue;

          const snakeName = toSnakeCase(key);
          if (snakeName !== key) {
            column.data.name = snakeName;
          }
        }
      }

      return {
        shape,
        type: undefined as unknown as ColumnShapeOutput<T>,
      };
    }

    belongsTo<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Options extends {
        primaryKey: keyof InstanceType<Related>['columns']['shape'];
        foreignKey: keyof Self['columns']['shape'];
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'belongsTo' as const,
        returns: 'one' as const,
        fn,
        options,
      };
    }

    hasOne<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends (
        | {
            primaryKey: keyof Self['columns']['shape'];
            foreignKey: keyof InstanceType<Related>['columns']['shape'];
          }
        | {
            through: Through;
            source: Source;
          }
      ) & {
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasOne' as const,
        returns: 'one' as const,
        fn,
        options,
      };
    }

    hasMany<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends (
        | {
            primaryKey: keyof Self['columns']['shape'];
            foreignKey: keyof InstanceType<Related>['columns']['shape'];
          }
        | {
            through: Through;
            source: Source;
          }
      ) & {
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasMany' as const,
        returns: 'many' as const,
        fn,
        options,
      };
    }

    hasAndBelongsToMany<
      Self extends this,
      Related extends TableClass,
      Scope extends Query,
      Options extends {
        primaryKey: keyof Self['columns']['shape'];
        associationPrimaryKey: keyof InstanceType<Related>['columns']['shape'];
        foreignKey: string;
        associationForeignKey: string;
        joinTable: string;
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => Related, options: Options) {
      return {
        type: 'hasAndBelongsToMany' as const,
        returns: 'many' as const,
        fn,
        options,
      };
    }
  };

  base.prototype.columnTypes = columnTypes;

  return base;
};
