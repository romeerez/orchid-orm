import { PostgresModelConstructor } from './model';

export type RelationThunk<T extends PostgresModelConstructor> = {
  repoFn(): T;
};

export type RelationThunks = Record<
  string,
  RelationThunk<PostgresModelConstructor>
>;

export const belongsTo = <T extends PostgresModelConstructor>(
  repoFn: () => T,
): RelationThunk<T> => {
  return { repoFn };
};

export const hasOne = <T extends PostgresModelConstructor>(
  repoFn: () => T,
): RelationThunk<T> => {
  return { repoFn };
};
