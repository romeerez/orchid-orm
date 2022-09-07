import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { pushQueryValue, setQueryValue } from '../queryDataUtils';
import { isRaw, RawExpression } from '../common';
import { BelongsToRelation, Relation } from '../relations';

export type ReturningArg<T extends Query> = (keyof T['shape'])[] | '*';

type OptionalKeys<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['isPrimaryKey'] extends true
    ? K
    : T['shape'][K]['isNullable'] extends true
    ? K
    : never;
}[keyof T['shape']];

type BelongsToRelations<T extends Query> = T['relations'] extends Record<
  string,
  Relation
>
  ? {
      [K in keyof T['relations'] as T['relations'][K] extends BelongsToRelation
        ? K
        : never]: T['relations'][K] extends BelongsToRelation
        ? T['relations'][K]
        : never;
    }
  : Record<never, BelongsToRelation>;

type InsertData<
  T extends Query,
  BT extends Record<string, BelongsToRelation> = BelongsToRelations<T>,
> = Omit<
  Omit<T['type'], OptionalKeys<T>> & {
    [K in OptionalKeys<T>]?: T['shape'][K]['type'];
  },
  { [K in keyof BT]: BT[K]['options']['foreignKey'] }[keyof BT]
> &
  // eslint-disable-next-line @typescript-eslint/ban-types
  ({} extends BT
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : {
        [Key in keyof BT]:
          | {
              [K in BT[Key]['options']['foreignKey']]: BT[Key]['options']['foreignKey'] extends keyof T['type']
                ? T['type'][BT[Key]['options']['foreignKey']]
                : never;
            }
          | {
              [K in Key]: InsertData<BT[Key]['model']>;
            };
      }[keyof BT]);

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
    data: InsertData<Query> & InsertData<Query>[],
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
  _insert(
    data:
      | Record<string, unknown>
      | Record<string, unknown>[]
      | { columns: string[]; values: RawExpression },
    returning?: unknown,
  ) {
    const q = Array.isArray(data)
      ? (this as unknown as Query)._all()
      : (this as unknown as Query)._take();

    let columns: string[];
    let values: unknown[][] | RawExpression;
    if (Array.isArray(data)) {
      const columnsMap: Record<string, true> = {};
      data.forEach((item) => {
        Object.keys(item).forEach((key) => {
          columnsMap[key] = true;
        });
      });

      columns = Object.keys(columnsMap);
      values = Array(data.length);
      data.forEach((item, i) => {
        (values as unknown[][])[i] = columns.map((key) => item[key]);
      });
    } else if (
      'values' in data &&
      typeof data.values === 'object' &&
      data.values &&
      isRaw(data.values)
    ) {
      columns = data.columns as string[];
      values = data.values;
    } else {
      columns = Object.keys(data);
      values = [Object.values(data)];
    }

    setQueryValue(q, 'type', 'insert');
    setQueryValue(q, 'columns', columns);
    setQueryValue(q, 'values', values);

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
