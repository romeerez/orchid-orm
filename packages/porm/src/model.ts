import {
  ColumnShapeOutput,
  ColumnsShape,
  ColumnTypesBase,
  Db,
  getColumnTypes,
  Query,
} from 'pqb';
import { MapRelations, Relation, RelationThunks } from './relations/relations';

export type ModelClass<T extends Model = Model> = (new () => T) & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods?: Record<string, (...args: any[]) => any>;
};

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
    : Query['relations']
>;

export type DbModel<T extends Model> = ModelToDb<T> &
  Omit<MapRelations<T>, keyof Query>;

type ModelConfig = {
  shape: ColumnsShape;
  type: unknown;
};

type ScopeFn<Related extends Model, Scope extends Query> = (
  q: Db<Related['table'], Related['columns']['shape']>,
) => Scope;

export type Model = {
  table: string;
  columns: ModelConfig;
  schema?: string;
};

export type MethodsBase<T extends new () => Model> = Record<
  string,
  (
    q: Omit<DbModel<InstanceType<T>>, 'hasSelect'> & {
      hasSelect: boolean;
    },
    ...args: any[]
  ) => any
>;

export const createModel = <CT extends ColumnTypesBase>(options: {
  columnTypes: CT;
}) => {
  return class Model {
    table!: string;
    columns!: ModelConfig;
    schema?: string;

    static makeMethods<
      T extends new () => Model,
      Methods extends MethodsBase<T>,
    >(this: T, methods: Methods): Methods {
      return methods;
    }

    static setMethods<
      T extends new () => Model,
      Methods extends MethodsBase<T>,
    >(this: T, methods: Methods): T & { methods: Methods } {
      return Object.assign(this, { methods });
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
      Related extends Model,
      Scope extends Query,
      Options extends {
        primaryKey: keyof Related['columns']['shape'];
        foreignKey: keyof Self['columns']['shape'];
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => ModelClass<Related>, options: Options) {
      return {
        type: 'belongsTo' as const,
        returns: 'one' as const,
        fn,
        options,
      };
    }

    hasOne<
      Self extends this,
      Related extends Model,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends (
        | {
            primaryKey: keyof Self['columns']['shape'];
            foreignKey: keyof Related['columns']['shape'];
          }
        | {
            through: Through;
            source: Source;
          }
      ) & {
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => ModelClass<Related>, options: Options) {
      return {
        type: 'hasOne' as const,
        returns: 'one' as const,
        fn,
        options,
      };
    }

    hasMany<
      Self extends this,
      Related extends Model,
      Scope extends Query,
      Through extends string,
      Source extends string,
      Options extends (
        | {
            primaryKey: keyof Self['columns']['shape'];
            foreignKey: keyof Related['columns']['shape'];
          }
        | {
            through: Through;
            source: Source;
          }
      ) & {
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => ModelClass<Related>, options: Options) {
      return {
        type: 'hasMany' as const,
        returns: 'many' as const,
        fn,
        options,
      };
    }

    hasAndBelongsToMany<
      Self extends this,
      Related extends Model,
      Scope extends Query,
      Options extends {
        primaryKey: keyof Self['columns']['shape'];
        associationPrimaryKey: keyof Related['columns']['shape'];
        foreignKey: string;
        associationForeignKey: string;
        joinTable: string;
        scope?: ScopeFn<Related, Scope>;
        required?: boolean;
      },
    >(this: Self, fn: () => ModelClass<Related>, options: Options) {
      return {
        type: 'hasAndBelongsToMany' as const,
        returns: 'many' as const,
        fn,
        options,
      };
    }
  };
};
