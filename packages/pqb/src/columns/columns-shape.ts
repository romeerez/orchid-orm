import { Column } from './column';
import { OperatorsAny } from './operators';
import { ShallowSimplify } from '../core';

export interface ColumnsShape {
  [K: string]: Column;
}

export namespace ColumnsShape {
  // type of columns selected by default, `hidden` columns are omitted
  export type DefaultSelectKeys<S extends Column.QueryColumnsInit> = {
    [K in keyof S]: S[K]['data']['explicitSelect'] extends true | undefined
      ? never
      : K;
  }[keyof S];

  // Type of data returned from the table query by default, doesn't include computed columns.
  // `const user: User[] = await db.user;`
  export type DefaultOutput<Set extends Column.QueryColumnsInit> = {
    [K in DefaultSelectKeys<Set>]: Set[K]['outputType'];
  };

  // get columns object type where nullable columns or columns with a default are optional
  export type Input<
    Shape extends Column.QueryColumnsInit,
    AppReadOnly = {
      [K in keyof Shape]: Shape[K]['data']['appReadOnly'] extends true
        ? K
        : never;
    }[keyof Shape],
    Optional extends keyof Shape = {
      [K in keyof Shape]: Shape[K]['data']['optional'] extends true ? K : never;
    }[keyof Shape],
  > = {
    [K in Exclude<keyof Shape, AppReadOnly | Optional>]: Shape[K]['inputType'];
  } & { [K in Exclude<Optional, AppReadOnly>]?: Shape[K]['inputType'] };

  export type InputPartial<Shape extends Column.QueryColumnsInit> = {
    [K in keyof Shape]?: Shape[K]['inputType'];
  };

  // output of the shape of columns
  export type Output<Shape extends Column.QueryColumns> = {
    [K in keyof Shape]: Shape[K]['outputType'];
  };

  // table output type returned by default, with no select
  export type DefaultSelectOutput<Shape extends Column.QueryColumnsInit> = {
    [K in keyof Shape as Shape[K]['data']['explicitSelect'] extends
      | true
      | undefined
      ? never
      : K]: Shape[K]['outputType'];
  };

  export interface MapToObjectColumn<Shape extends Column.QueryColumns> {
    dataType: 'object';
    type: {
      [K in keyof Shape]: Shape[K]['type'];
    };
    outputType: ShallowSimplify<ObjectOutput<Shape>>;
    queryType: {
      [K in keyof Shape]: Shape[K]['queryType'];
    };
    operators: OperatorsAny;
  }

  export interface MapToNullableObjectColumn<
    Shape extends Column.QueryColumns,
  > {
    dataType: 'object';
    type: {
      [K in keyof Shape]: Shape[K]['type'];
    };
    outputType: ShallowSimplify<ObjectOutput<Shape>> | undefined;
    queryType:
      | {
          [K in keyof Shape]: Shape[K]['queryType'];
        }
      | null;
    operators: OperatorsAny;
  }

  export interface MapToPluckColumn<Shape extends Column.QueryColumns> {
    dataType: 'array';
    type: Shape['pluck']['type'][];
    outputType: Shape['pluck']['outputType'][];
    queryType: Shape['pluck']['queryType'][];
    operators: OperatorsAny;
  }

  export interface MapToObjectArrayColumn<Shape extends Column.QueryColumns> {
    dataType: 'array';
    type: {
      [K in keyof Shape]: Shape[K]['type'];
    }[];
    outputType: ShallowSimplify<ObjectOutput<Shape>>[];
    queryType: {
      [K in keyof Shape]: Shape[K]['queryType'];
    }[];
    operators: OperatorsAny;
  }

  // Because this is passed to `ShallowSimplify` it takes fewer instantiations to keep it as a type helper
  type ObjectOutput<Shape extends Column.QueryColumns> = {
    [K in keyof Shape]: Shape[K]['outputType'];
  };
}
