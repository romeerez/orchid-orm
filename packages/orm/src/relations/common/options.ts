import { TableData } from 'pqb';
import { ColumnShapeInputPartial, ColumnsShapeBase } from 'orchid-core';

export interface RelationRefsOptions<
  Column extends PropertyKey = string,
  Shape extends ColumnsShapeBase = ColumnsShapeBase,
> {
  required?: boolean;
  columns: Column[];
  references: (keyof Shape)[];
  foreignKey?: boolean | TableData.References.Options;
  on?: ColumnShapeInputPartial<Shape>;
}

export interface RelationThroughOptions<
  Through extends PropertyKey = string,
  Source extends PropertyKey = string,
> {
  through: Through;
  source: Source;
}
