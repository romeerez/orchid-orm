import {
  PickQueryMetaTable,
  PickQueryMetaTableShape,
} from './pick-query-types';
import { RecordString } from '../utils';
import { QueryBase } from './query';
import { QueryDataBase } from './query-data';

interface PickQueryDataAliases {
  aliases?: RecordString;
}

export interface QueryDataAliases extends PickQueryDataAliases {
  as?: string;
  // stores `aliases` of the parent query object when the current query object is withing a query callback.
  outerAliases?: RecordString;
}

export type AliasOrTable<T extends PickQueryMetaTable> =
  T['meta']['as'] extends string
    ? T['meta']['as']
    : T['table'] extends string
    ? T['table']
    : never;

export type SetQueryTableAlias<
  T extends PickQueryMetaTableShape,
  As extends string,
> = {
  [K in keyof T]: K extends 'meta'
    ? {
        [K in keyof T['meta'] | 'as']: K extends 'as'
          ? As
          : K extends 'selectable'
          ? Omit<
              T['meta']['selectable'],
              `${AliasOrTable<T>}.${keyof T['shape'] & string}`
            > & {
              [K in keyof T['shape'] & string as `${As}.${K}`]: {
                as: K;
                column: T['shape'][K];
              };
            }
          : T['meta'][K];
      }
    : T[K];
};

export type AsQueryArg = PickQueryMetaTableShape;

/** getters **/

export const _getQueryAs = (q: QueryBase): string | undefined => q.q.as;

export const _getQueryFreeAlias = (q: QueryDataAliases, as: string): string =>
  q.aliases ? getQueryDataFreeAlias(q.aliases, as) : as;

const getQueryDataFreeAlias = (aliases: RecordString, as: string): string => {
  if (!aliases[as]) return as;

  let suffix = 2;
  let privateAs;
  while (aliases[(privateAs = as + suffix)]) {
    suffix++;
  }

  return privateAs;
};

export const _checkIfAliased = (
  q: QueryBase,
  as: string,
  name: string,
): boolean => {
  return q.q.aliases?.[as] === name;
};

export const _getQueryAliasOrName = (
  q: PickQueryDataAliases,
  as: string,
): string => {
  return q.aliases?.[as] || as;
};

export const _getQueryOuterAliases = (
  q: QueryDataBase,
): RecordString | undefined => {
  return q.outerAliases;
};

/** setters **/

export const _setQueryAs = <T extends AsQueryArg, As extends string>(
  self: T,
  as: As,
): SetQueryTableAlias<T, As> => {
  const { q } = self as unknown as QueryBase;
  q.as = as;
  q.aliases = {
    ...q.aliases!,
    [as]: _getQueryFreeAlias(q, as),
  };

  return self as never;
};

export const _setQueryAlias = (
  q: QueryBase,
  name: string,
  as: string,
): void => {
  q.q.aliases = { ...q.q.aliases, [as]: name };
};

export const _setSubQueryAliases = (q: QueryBase): void => {
  q.q.outerAliases = q.q.aliases;
};

/**
 * Is used in `chain`: combines query and its relation aliases,
 * stores the result to the relation query data.
 */
export const _applyRelationAliases = (
  query: QueryBase,
  relQueryData: QueryDataBase,
): void => {
  const aliases = query.q.as
    ? { ...query.q.aliases }
    : { ...query.q.aliases, [query.table as string]: query.table as string };

  const relAliases = relQueryData.aliases!; // is always set for a relation
  for (const as in relAliases) {
    aliases[as] = getQueryDataFreeAlias(aliases, as);
  }
  relQueryData.as = aliases[relQueryData.as!]; // `as` is always set for a relation;
  relQueryData.aliases = aliases;
};

export const _copyQueryAliasToQuery = (
  fromQuery: QueryBase,
  toQuery: QueryBase,
  key: string,
): string => {
  const name = _getQueryAliasOrName(fromQuery.q, key);
  if (name !== key) {
    _setQueryAlias(toQuery, name, key);
  }
  return name;
};
