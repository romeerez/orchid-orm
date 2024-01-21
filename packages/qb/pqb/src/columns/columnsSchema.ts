import { ColumnType } from './columnType';
import { OperatorsAny } from './operators';
import { QueryColumns } from 'orchid-core';

export type ColumnsShape = Record<string, ColumnType>;

export type ColumnsShapeToObject<Shape extends QueryColumns> = {
  dataType: 'object';
  type: ObjectType<Shape>;
  outputType: ObjectOutput<Shape>;
  queryType: ObjectQuery<Shape>;
  operators: OperatorsAny;
};

export type ColumnsShapeToNullableObject<Shape extends QueryColumns> = {
  dataType: 'object';
  type: ObjectType<Shape>;
  outputType: ObjectOutput<Shape> | null;
  queryType: ObjectQuery<Shape> | null;
  operators: OperatorsAny;
};

type ObjectType<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['type'];
};

type ObjectOutput<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['outputType'];
};

type ObjectQuery<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['queryType'];
};

export type ColumnsShapeToPluck<Shape extends QueryColumns> = {
  dataType: 'array';
  type: Shape['pluck']['type'][];
  outputType: Shape['pluck']['outputType'][];
  queryType: Shape['pluck']['queryType'][];
  operators: OperatorsAny;
};

export type ColumnsShapeToObjectArray<Shape extends QueryColumns> = {
  dataType: 'array';
  type: ObjectType<Shape>[];
  outputType: ObjectOutput<Shape>[];
  queryType: ObjectQuery<Shape>[];
  operators: OperatorsAny;
};
