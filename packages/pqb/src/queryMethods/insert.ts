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

type InsertOneResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends ReturningArg<T>
  ? Returning extends '*'
    ? SetQueryReturnsOne<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsOne<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsVoid<T>;

type InsertManyResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends ReturningArg<T>
  ? Returning extends '*'
    ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsVoid<T>;

type OnConflictArg<T extends Query> =
  | keyof T['shape']
  | (keyof T['shape'])[]
  | RawExpression;

export class Insert {
  insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>,
    returning?: Returning,
  ): InsertOneResult<T, Returning>;
  insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>[] | { columns: string[]; values: RawExpression },
    returning?: Returning,
  ): InsertManyResult<T, Returning>;
  insert(
    this: Query,
    data: InsertData<Query>,
    returning?: ReturningArg<Query>,
  ) {
    return this.clone()._insert(data, returning) as unknown as InsertOneResult<
      Query,
      ReturningArg<Query>
    > &
      InsertManyResult<Query, ReturningArg<Query>>;
  }

  _insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>,
    returning?: Returning,
  ): InsertOneResult<T, Returning>;
  _insert<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(
    this: T,
    data: InsertData<T>[] | { columns: string[]; values: RawExpression },
    returning?: Returning,
  ): InsertManyResult<T, Returning>;
  _insert(data: unknown, returning?: unknown) {
    const q = Array.isArray(data)
      ? (this as unknown as Query)._all()
      : (this as unknown as Query)._take();
    setQueryValue(q, 'type', 'insert');
    setQueryValue(q, 'data', data);
    if (returning) {
      pushQueryValue(q, 'returning', returning);
    }
    return q as unknown as InsertOneResult<Query, ReturningArg<Query>> &
      InsertManyResult<Query, ReturningArg<Query>>;
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
