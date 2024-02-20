import { ScopeFn, TableClass } from '../../baseTable';
import { Query } from 'pqb';

export interface RelationCommonOptions<
  Related extends TableClass = TableClass,
  Scope extends Query = Query,
> {
  scope?: ScopeFn<Related, Scope>;
  required?: boolean;
}

export interface RelationRefsOptions<
  Column extends PropertyKey = string,
  Ref extends PropertyKey = string,
> {
  columns: Column[];
  references: Ref[];
}

export interface RelationKeysOptions<
  PK extends PropertyKey = string,
  FK extends PropertyKey = string,
> {
  primaryKey: PK;
  foreignKey: FK;
}

export type RelationRefsOrKeysOptions<
  Column extends PropertyKey = string,
  Ref extends PropertyKey = string,
  PK extends PropertyKey = string,
  FK extends PropertyKey = string,
> = RelationRefsOptions<Column, Ref> | RelationKeysOptions<PK, FK>;

export interface RelationThroughOptions<
  Through extends PropertyKey = string,
  Source extends PropertyKey = string,
> {
  through: Through;
  source: Source;
}

export type RelationHasOptions<
  Column extends PropertyKey = string,
  Ref extends PropertyKey = string,
> = RelationRefsOrKeysOptions<Column, Ref, Column, Ref>;
