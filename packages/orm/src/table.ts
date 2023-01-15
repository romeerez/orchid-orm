import {
  ColumnShapeOutput,
  ColumnsShape,
  ColumnTypesBase,
  Db,
  getColumnTypes,
  Query,
} from 'pqb';
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
          [K in keyof T['relations']]: Relation<T, T['relations'], K>;
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

export const createBaseTable = <CT extends ColumnTypesBase>(options: {
  columnTypes: CT;
}) => {
  return class BaseTable {
    table!: string;
    columns!: TableConfig;
    schema?: string;
    columnTypes: CT;
    noPrimaryKey?: boolean;

    constructor() {
      this.columnTypes = options.columnTypes;
    }

    setColumns = <T extends ColumnsShape>(
      fn: (t: CT) => T,
    ): { shape: T; type: ColumnShapeOutput<T> } => {
      const shape = getColumnTypes(options.columnTypes, fn);

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
};
