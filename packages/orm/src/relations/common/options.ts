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

export interface RelationThroughOptions<
  Through extends PropertyKey = string,
  Source extends PropertyKey = string,
> {
  through: Through;
  source: Source;
}
