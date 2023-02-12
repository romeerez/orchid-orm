import { Query } from '../query';
import {
  AggregateItemOptions,
  ColumnOperators,
  HavingItem,
  OrderItem,
  WhereItem,
} from '../sql';
import { pushQueryArray } from '../queryDataUtils';
import { Aggregate1ArgumentTypes, AggregateOptions } from './aggregate';
import { isRaw, RawExpression } from '../raw';

type HavingArgObject<
  T extends Query,
  Agg extends keyof Aggregate1ArgumentTypes<T>,
> = {
  [Column in Exclude<Aggregate1ArgumentTypes<T>[Agg], RawExpression>]?:
    | T['selectable'][Column]['column']['type']
    | (ColumnOperators<T['selectable'], Column> & AggregateOptions<T>);
};

export type HavingArg<T extends Query = Query> =
  | ({
      [Agg in keyof Aggregate1ArgumentTypes<T>]?: HavingArgObject<T, Agg>;
    } & {
      count?: number | HavingArgObject<T, 'count'>;
    })
  | Query
  | RawExpression;

const processHavingArg = <T extends Query>(arg: HavingArg<T>): HavingItem => {
  if ('baseQuery' in arg || isRaw(arg)) {
    return arg;
  } else {
    const processed = { ...arg } as Record<
      string,
      Record<string, AggregateItemOptions>
    >;

    for (const fn in arg) {
      const data = arg[fn as keyof typeof arg];
      if (typeof data === 'object') {
        processed[fn] = { ...data } as typeof processed[string];
        for (const column in data) {
          const value = data[column as keyof typeof data];

          if (typeof value === 'object') {
            processed[fn][column] = { ...(value as object) };

            const options = value as AggregateOptions<T>;

            if (
              'order' in options &&
              options.order &&
              !Array.isArray(options.order)
            ) {
              processed[fn][column].order = [options.order as OrderItem];
            }

            if ('filter' in options && options.filter) {
              processed[fn][column].filter = options.filter as WhereItem;
            }

            if ('filterOr' in options && options.filterOr) {
              processed[fn][column].filterOr = options.filterOr as WhereItem[];
            }
          }
        }
      }
    }
    return processed;
  }
};

export class Having {
  having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return this.clone()._having(...args);
  }

  _having<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return pushQueryArray(
      this,
      'having',
      args.map((arg) => processHavingArg(arg)),
    );
  }

  havingOr<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return this.clone()._havingOr(...args);
  }

  _havingOr<T extends Query>(this: T, ...args: HavingArg<T>[]): T {
    return pushQueryArray(
      this,
      'havingOr',
      args.map((arg) => [processHavingArg(arg)]),
    );
  }
}
