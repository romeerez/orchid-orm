import { Column } from './column';

// method names for numeric columns and JSON types to generate methods' code
export const numberMethodNames: (keyof AdditionalNumberData)[] = [
  'gt',
  'gte',
  'lt',
  'lte',
  'step',
  'int',
  'finite',
  'safe',
];

export interface AdditionalNumberData {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  step?: number;
  int?: boolean;
  finite?: boolean;
  safe?: boolean;
}

// numeric column and JSON type data for validations
export interface BaseNumberData extends Column.Data, AdditionalNumberData {}

// method names for string columns and JSON types to generate methods' code
export const stringMethodNames: (keyof AdditionalStringData)[] = [
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
  'ipv4',
  'ipv6',
  'trim',
  'toLowerCase',
  'toUpperCase',
];

export interface AdditionalStringData {
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
  ipv4?: true;
  ipv6?: true;
  nonEmpty?: boolean;
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
}

// string column and JSON type data for validations
export interface StringData extends Column.Data, AdditionalStringData {}

// method names for date columns to generate methods' code
export const dateMethodNames: (keyof AdditionalDateData)[] = ['min', 'max'];

export interface AdditionalDateData {
  min?: Date;
  max?: Date;
}

// date column data for validations
export interface DateColumnData extends Column.Data, AdditionalDateData {}

// method names for array column and JSON type to generate methods' code
export const arrayMethodNames: (keyof ArrayMethodsData)[] = [
  'min',
  'max',
  'length',
  'nonEmpty',
];

// array column and JSON type data for validations
export interface ArrayMethodsData {
  min?: number;
  max?: number;
  length?: number;
  nonEmpty?: boolean;
}

export interface ArrayMethodsDataForBaseColumn
  extends Column.Data,
    ArrayMethodsData {}
