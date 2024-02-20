import { ColumnType } from './columnType';
import { OperatorsAny } from './operators';
import { QueryColumns } from 'orchid-core';

export interface ColumnsShape {
  [K: string]: ColumnType;
}

export interface ColumnsShapeToObject<Shape extends QueryColumns> {
  dataType: 'object';
  type: ObjectType<Shape>;
  outputType: ObjectOutput<Shape>;
  queryType: ObjectQuery<Shape>;
  operators: OperatorsAny;
}

export interface ColumnsShapeToNullableObject<Shape extends QueryColumns> {
  dataType: 'object';
  type: ObjectType<Shape>;
  outputType: ObjectOutput<Shape> | null;
  queryType: ObjectQuery<Shape> | null;
  operators: OperatorsAny;
}

type ObjectType<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['type'];
};

type ObjectOutput<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['outputType'];
};

type ObjectQuery<Shape extends QueryColumns> = {
  [K in keyof Shape]: Shape[K]['queryType'];
};

export interface ColumnsShapeToPluck<Shape extends QueryColumns> {
  dataType: 'array';
  type: Shape['pluck']['type'][];
  outputType: Shape['pluck']['outputType'][];
  queryType: Shape['pluck']['queryType'][];
  operators: OperatorsAny;
}

export interface ColumnsShapeToObjectArray<Shape extends QueryColumns> {
  dataType: 'array';
  type: ObjectType<Shape>[];
  outputType: ObjectOutput<Shape>[];
  queryType: ObjectQuery<Shape>[];
  operators: OperatorsAny;
}
