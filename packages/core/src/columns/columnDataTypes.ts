import { ColumnDataBase } from './columnType';

// method names for numeric columns and JSON types to generate methods' code
export const numberMethodNames: Exclude<
  keyof BaseNumberData,
  keyof ColumnDataBase
>[] = ['gt', 'gte', 'lt', 'lte', 'step', 'int', 'finite', 'safe'];

// numeric column and JSON type data for validations
export type BaseNumberData = ColumnDataBase & {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  step?: number;
  int?: boolean;
  finite?: boolean;
  safe?: boolean;
};

// method names for string columns and JSON types to generate methods' code
export const stringMethodNames: Exclude<
  keyof StringTypeData,
  keyof ColumnDataBase
>[] = [
  'nonEmpty',
  'min',
  'max',
  'length',
  'email',
  'url',
  'emoji',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'regex',
  'includes',
  'startsWith',
  'endsWith',
  'datetime',
  'ip',
  'trim',
  'toLowerCase',
  'toUpperCase',
];

// string column and JSON type data for validations
export interface StringTypeData extends ColumnDataBase {
  min?: number;
  max?: number;
  length?: number;
  email?: boolean;
  url?: boolean;
  emoji?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  cuid2?: boolean;
  ulid?: boolean;
  regex?: RegExp;
  includes?: string;
  startsWith?: string;
  endsWith?: string;
  datetime?: {
    offset?: boolean;
    precision?: number;
  };
  ip?: {
    version?: 'v4' | 'v6';
  };
  nonEmpty?: boolean;
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
}

// method names for date columns to generate methods' code
export const dateMethodNames: Exclude<
  keyof DateColumnData,
  keyof ColumnDataBase
>[] = ['min', 'max'];

// date column data for validations
export type DateColumnData = ColumnDataBase & {
  min?: Date;
  max?: Date;
};

// method names for array column and JSON type to generate methods' code
export const arrayMethodNames: Exclude<
  keyof ArrayMethodsData,
  keyof ColumnDataBase
>[] = ['min', 'max', 'length', 'nonEmpty'];

// array column and JSON type data for validations
export type ArrayMethodsData = ColumnDataBase & {
  min?: number;
  max?: number;
  length?: number;
  nonEmpty?: boolean;
};
