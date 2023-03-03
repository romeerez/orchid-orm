import { ColumnDataBase } from './columnType';

export type BaseNumberData = ColumnDataBase & {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  multipleOf?: number;
  int?: boolean;
};

export type BaseStringData = ColumnDataBase & {
  min?: number;
  max?: number;
  length?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  regex?: RegExp;
  startsWith?: string;
  endsWith?: string;
  trim?: boolean;
  isNonEmpty?: true;
};

export type DateColumnData = ColumnDataBase & {
  min?: Date;
  max?: Date;
};
