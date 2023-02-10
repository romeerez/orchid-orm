import { WithOptions } from '../sql';
import { ColumnShapeOutput, ColumnsShape, ColumnTypes } from '../columns';
import { isRaw, RawExpression } from '../raw';
import { AddQueryWith, Query } from '../query';
import { Db } from '../db';
import { pushQueryValue, setQueryObjectValue } from '../queryDataUtils';
import { EMPTY_OBJECT } from '../utils';

type WithArgsOptions = Omit<WithOptions, 'columns'> & {
  columns?: boolean | string[];
};

type WithArgs =
  | [string, ColumnsShape, RawExpression]
  | [string, WithArgsOptions, ColumnsShape, RawExpression]
  | [string, Query | ((qb: Db) => Query)]
  | [string, WithArgsOptions, Query | ((qb: Db) => Query)];

type WithShape<Args extends WithArgs> = Args[1] extends Query
  ? Args[1]['result']
  : Args[1] extends (qb: Db) => Query
  ? ReturnType<Args[1]>['result']
  : Args[2] extends Query
  ? Args[2]['result']
  : Args[2] extends (qb: Db) => Query
  ? ReturnType<Args[2]>['result']
  : Args[1] extends ColumnsShape
  ? Args[1]
  : Args[2] extends ColumnsShape
  ? Args[2]
  : Args[2] extends (t: ColumnTypes) => ColumnsShape
  ? ReturnType<Args[2]>
  : never;

type WithResult<
  T extends Query,
  Args extends WithArgs,
  Shape extends ColumnsShape,
> = AddQueryWith<
  T,
  {
    table: Args[0];
    shape: Shape;
    type: ColumnShapeOutput<Shape>;
  }
>;

export class With {
  with<
    T extends Query,
    Args extends WithArgs,
    Shape extends ColumnsShape = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    return this.clone()._with<T, Args, Shape>(...args);
  }

  _with<
    T extends Query,
    Args extends WithArgs,
    Shape extends ColumnsShape = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    let options =
      (args.length === 3 && !isRaw(args[2])) || args.length === 4
        ? (args[1] as WithArgsOptions | WithOptions)
        : undefined;

    const last = args[args.length - 1] as
      | Query
      | ((qb: Db) => Query)
      | RawExpression;

    const query = typeof last === 'function' ? last(this.queryBuilder) : last;

    const shape =
      args.length === 4 ? (args[2] as ColumnsShape) : (query as Query).shape;

    if (options?.columns === true) {
      options = {
        ...options,
        columns: Object.keys(shape),
      };
    }

    pushQueryValue(this, 'with', [args[0], options || EMPTY_OBJECT, query]);

    return setQueryObjectValue(
      this,
      'withShapes',
      args[0],
      shape,
    ) as unknown as WithResult<T, Args, Shape>;
  }
}
