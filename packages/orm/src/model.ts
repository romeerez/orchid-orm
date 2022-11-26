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

export type ModelClass<T extends Model = Model> = new () => T;

export type ModelClasses = Record<string, ModelClass>;

export type ModelToDb<T extends Model> = Db<
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
> & { definedAs: string; db: OrchidORM<ModelClasses> };

export type DbModel<T extends ModelClass> = ModelToDb<InstanceType<T>> &
  Omit<MapRelations<InstanceType<T>>, keyof Query>;

type ModelConfig = {
  shape: ColumnsShape;
  type: unknown;
};

type ScopeFn<Related extends ModelClass, Scope extends Query> = (
  q: DbModel<Related>,
) => Scope;

export type Model = {
  table: string;
  columns: ModelConfig;
  schema?: string;
  columnTypes: ColumnTypesBase;
};

export const createModel = <CT extends ColumnTypesBase>(options: {
  columnTypes: CT;
}) => {
  return class Model {
    table!: string;
    columns!: ModelConfig;
    schema?: string;
    columnTypes: CT;

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
      Related extends ModelClass,
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
      Related extends ModelClass,
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
      Related extends ModelClass,
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
      Related extends ModelClass,
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
