import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { pushQueryValue, setQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';

export type ReturningArg<T extends Query> = (keyof T['shape'])[] | '*';

type OptionalKeys<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['isPrimaryKey'] extends true
    ? K
    : T['shape'][K]['isNullable'] extends true
    ? K
    : never;
}[keyof T['shape']];

type InsertData<T extends Query> = Omit<T['type'], OptionalKeys<T>> & {
  [K in OptionalKeys<T>]?: T['shape'][K]['type'];
};

type InsertArgs<T extends Query> = [
  data:
    | InsertData<T>
    | InsertData<T>[]
    | {
        columns: string[];
        values: RawExpression;
      },
  returning?: ReturningArg<T>,
];

type InsertResult<
  T extends Query,
  Args extends InsertArgs<T>,
> = Args[1] extends ReturningArg<T>
  ? Args[0] extends
      | Array<unknown>
      | {
          columns: string[];
          values: RawExpression;
        }
    ? Args[1] extends '*'
      ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
      : SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
    : Args[1] extends '*'
    ? SetQueryReturnsOne<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsOne<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
  : SetQueryReturnsVoid<T>;

type OnConflictArg<T extends Query> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | RawExpression;

export class Insert {
  insert<T extends Query, Args extends InsertArgs<T>>(
    this: T,
    ...args: Args
  ): InsertResult<T, Args> {
    return this.clone()._insert(...args) as unknown as InsertResult<T, Args>;
  }

  _insert<T extends Query, Args extends InsertArgs<T>>(
    this: T,
    ...args: Args
  ): InsertResult<T, Args> {
    const [data, returning] = args;
    const q = Array.isArray(data) ? this._all() : this._take();
    setQueryValue(q, 'type', 'insert');
    setQueryValue(q, 'data', data);
    if (returning) {
      pushQueryValue(q, 'returning', returning);
    }
    return q as unknown as InsertResult<T, Args>;
  }

  onConflict<T extends Query, Arg extends OnConflictArg<T>>(
    this: T,
    arg?: Arg,
  ): OnConflictQueryBuilder<T, Arg> {
    return this.clone()._onConflict(arg);
  }

  _onConflict<
    T extends Query,
    Arg extends OnConflictArg<T> | undefined = undefined,
  >(this: T, arg?: Arg): OnConflictQueryBuilder<T, Arg> {
    return new OnConflictQueryBuilder(this, arg as Arg);
  }
}

export class OnConflictQueryBuilder<
  T extends Query,
  Arg extends OnConflictArg<T> | undefined,
> {
  constructor(private query: T, private onConflict: Arg) {}

  ignore(): T {
    const q = this.query.toQuery();
    setQueryValue(q, 'onConflict', {
      type: 'ignore',
      expr: this.onConflict,
    });
    return q;
  }

  merge(
    update?:
      | keyof T['shape']
      | (keyof T['shape'])[]
      | Partial<T['type']>
      | RawExpression,
  ): T {
    const q = this.query.toQuery();
    setQueryValue(q, 'onConflict', {
      type: 'merge',
      expr: this.onConflict,
      update,
    });
    return q;
  }
}
