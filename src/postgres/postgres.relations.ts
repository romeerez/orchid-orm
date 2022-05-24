import { RepoConstructor } from './postgres.orm';

export type RelationThunk<T extends RepoConstructor> = {
  repoFn(): T;
};

export type RelationThunks = Record<string, RelationThunk<RepoConstructor>>;

export const belongsTo = <T extends RepoConstructor>(
  repoFn: () => T
): RelationThunk<T> => {
  return { repoFn };
};

export const hasOne = <T extends RepoConstructor>(
  repoFn: () => T
): RelationThunk<T> => {
  return { repoFn };
};
