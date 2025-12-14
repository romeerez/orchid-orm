import { TableData, ColumnsShape, Column } from 'pqb';

export interface RelationRefsOptions<
  Column extends PropertyKey = string,
  Shape extends Column.Shape.QueryInit = Column.Shape.QueryInit,
> {
  required?: boolean;
  columns: Column[];
  references: (keyof Shape)[];
  foreignKey?: boolean | TableData.References.Options;
  on?: ColumnsShape.InputPartial<Shape>;
}

export interface RelationThroughOptions<
  Through extends PropertyKey = string,
  Source extends PropertyKey = string,
> {
  through: Through;
  source: Source;
}
