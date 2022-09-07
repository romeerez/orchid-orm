import {
  ColumnShapeOutput,
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  Db,
  Query,
} from 'pqb';
import { MapRelations, RelationThunks } from './relations/relations';

export type ModelClass<T extends Model = Model> = new () => T;

export type ModelClasses = Record<string, ModelClass>;

export type ModelToDb<
  T extends ModelClass,
  Model extends InstanceType<T> = InstanceType<T>,
> = Db<
  Model['table'],
  Model['columns']['shape'],
  'relations' extends keyof Model
    ? Model['relations'] extends RelationThunks
      ? {
          [K in keyof Model['relations']]: {
            type: Model['relations'][K]['type'];
            key: K;
            model: DbModel<ReturnType<Model['relations'][K]['fn']>>;
            joinQuery: Query;
          };
        }
      : Query['relations']
    : Query['relations']
>;

export type DbModel<T extends ModelClass> = ModelToDb<T> &
  Omit<MapRelations<InstanceType<T>>, keyof Query>;

type ModelConfig = {
  shape: ColumnsShape;
  type: unknown;
};

type ScopeFn<Related extends Model, Scope extends Query> = (
  q: Db<Related['table'], Related['columns']['shape']>,
) => Scope;

export abstract class Model {
  abstract table: string;
  abstract columns: ModelConfig;

  schema?: string;

  setColumns<T extends ColumnsShape>(
    fn: (t: ColumnTypes) => T,
  ): { shape: T; type: ColumnShapeOutput<T> } {
    const shape = fn(columnTypes);

    return {
      shape,
      type: undefined as unknown as ColumnShapeOutput<T>,
    };
  }

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
}
