import {
  ColumnShapeOutput,
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  Db,
  Query,
} from 'pqb';
import { MapRelations } from './relations/relations';

export type ModelClass<T extends Model = Model> = new () => T;

export type ModelClasses = Record<string, ModelClass>;

export type ModelToDb<T extends ModelClass> = Db<
  InstanceType<T>['table'],
  InstanceType<T>['columns']['shape']
>;

export type DbModel<T extends ModelClass> = ModelToDb<T> &
  MapRelations<InstanceType<T>>;

type ModelConfig = {
  shape: ColumnsShape;
  type: unknown;
};

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
      scope?(q: Db<Related['table'], Related['columns']['shape']>): Scope;
    },
  >(this: Self, fn: () => ModelClass<Related>, options: Options) {
    return {
      type: 'belongsTo' as const,
      fn,
      options,
    };
  }

  hasOne<
    Self extends this,
    Related extends Model,
    Scope extends Query,
    Options extends {
      primaryKey: keyof Self['columns']['shape'];
      foreignKey: keyof Related['columns']['shape'];
      scope?(q: Db<Related['table'], Related['columns']['shape']>): Scope;
    },
  >(this: Self, fn: () => ModelClass<Related>, options: Options) {
    return {
      type: 'hasOne' as const,
      fn,
      options,
    };
  }

  hasMany<
    Self extends this,
    Related extends Model,
    Scope extends Query,
    Options extends {
      primaryKey: keyof Self['columns']['shape'];
      foreignKey: keyof Related['columns']['shape'];
      scope?(q: Db<Related['table'], Related['columns']['shape']>): Scope;
    },
  >(this: Self, fn: () => ModelClass<Related>, options: Options) {
    return {
      type: 'hasMany' as const,
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
      scope?(q: Db<Related['table'], Related['columns']['shape']>): Scope;
    },
  >(this: Self, fn: () => ModelClass<Related>, options: Options) {
    return {
      type: 'hasAndBelongsToMany' as const,
      fn,
      options,
    };
  }
}
