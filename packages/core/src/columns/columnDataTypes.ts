import { ColumnDataBase } from './columnType';

export const numberMethodNames: Exclude<
  keyof BaseNumberData,
  keyof ColumnDataBase
>[] = ['gt', 'gte', 'lt', 'lte', 'step', 'int', 'finite', 'safe'];

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

export const stringMethodNames: Exclude<
  keyof BaseStringData,
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

export type BaseStringData = ColumnDataBase & {
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
};

export const dateMethodNames: Exclude<
  keyof DateColumnData,
  keyof ColumnDataBase
>[] = ['min', 'max'];

export type DateColumnData = ColumnDataBase & {
  min?: Date;
  max?: Date;
};

export const arrayMethodNames: Exclude<
  keyof ArrayMethodsData,
  keyof ColumnDataBase
>[] = ['min', 'max', 'length', 'nonEmpty'];

export type ArrayMethodsData = ColumnDataBase & {
  min?: number;
  max?: number;
  length?: number;
  nonEmpty?: boolean;
};

export const methodNamesOfSet: Exclude<
  keyof MethodsDataOfSet,
  keyof ColumnDataBase
>[] = ['nonEmpty', 'min', 'max', 'size'];

export type MethodsDataOfSet = ColumnDataBase & {
  nonEmpty?: boolean;
  min?: number;
  max?: number;
  size?: number;
};
