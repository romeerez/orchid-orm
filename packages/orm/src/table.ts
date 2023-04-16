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

export type TableClass<T extends Table = Table> = new () => T;

export type TableClasses = Record<string, TableClass>;

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
> & { definedAs: string; db: OrchidORM<TableClasses> };

export type DbTable<T extends TableClass> = TableToDb<InstanceType<T>> &
  Omit<MapRelations<InstanceType<T>>, keyof Query>;

type TableConfig = {
  shape: ColumnsShape;
  type: unknown;
};

type ScopeFn<Related extends TableClass, Scope extends Query> = (
  q: DbTable<Related>,
) => Scope;

export type Table = {
  table: string;
  columns: TableConfig;
  schema?: string;
  columnTypes: ColumnTypesBase;
  noPrimaryKey?: boolean;
};

export const createBaseTable = <CT extends ColumnTypesBase>(
  {
    columnTypes,
    snakeCase,
    filePath,
  }: {
    columnTypes?: CT | ((t: DefaultColumnTypes) => CT);
    snakeCase?: boolean;
    filePath?: string;
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
  );
};

const create = <CT extends ColumnTypesBase>(
  columnTypes: CT,
  filePath: string,
  snakeCase?: boolean,
) => {
  const base = class BaseTable {
    static filePath = filePath;

    table!: string;
    columns!: TableConfig;
    schema?: string;
    noPrimaryKey?: boolean;
    snakeCase = snakeCase;
    columnTypes: CT;

    constructor() {
      this.columnTypes = columnTypes;
    }

    setColumns = <T extends ColumnsShape>(
      fn: (t: CT) => T,
    ): { shape: T; type: ColumnShapeOutput<T> } => {
      (columnTypes as { [snakeCaseKey]?: boolean })[snakeCaseKey] =
        this.snakeCase;

      const shape = getColumnTypes(columnTypes, fn);

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
    };

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
