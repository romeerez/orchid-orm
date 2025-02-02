import { TableData } from 'pqb';

export interface RelationRefsOptions<
  Column extends PropertyKey = string,
  Ref extends PropertyKey = string,
> {
  required?: boolean;
  columns: Column[];
  references: Ref[];
  foreignKey?: boolean | TableData.References.Options;
}

export interface RelationThroughOptions<
  Through extends PropertyKey = string,
  Source extends PropertyKey = string,
> {
  through: Through;
  source: Source;
}
