import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsRowCount,
} from '../query';
import { pushQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';
import { ReturningArg } from './insert';

type UpdateData<T extends Query> = {
  [K in keyof T['type']]?: T['type'][K] | RawExpression;
};

type UpdateArgs<T extends Query> = [
  data: UpdateData<T> | RawExpression,
  returning?: ReturningArg<T>,
];

type UpdateResult<
  T extends Query,
  Args extends [_: unknown, returning?: ReturningArg<T>],
> = Args[1] extends ReturningArg<T>
  ? Args[1] extends '*'
    ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
  : SetQueryReturnsRowCount<T>;

type ChangeCountArgs<T extends Query> =
  | [
      arg: keyof T['shape'] | Partial<Record<keyof T['shape'], number>>,
      returning?: ReturningArg<T>,
    ];

const applyCountChange = <T extends Query, Args extends ChangeCountArgs<T>>(
  self: T,
  op: string,
  args: Args,
) => {
  const [data, returning] = args;
  self.query.type = 'update';

  let map: Record<string, { op: string; arg: number }>;
  if (typeof data === 'object') {
    map = {};
    for (const key in data) {
      map[key] = { op, arg: data[key] as number };
    }
  } else {
    map = { [data as string]: { op, arg: 1 } };
  }

  pushQueryValue(self, 'data', map);
  if (returning) {
    pushQueryValue(self, 'returning', returning);
  }
  return self as unknown as UpdateResult<T, Args>;
};

export class Update {
  update<T extends Query, Args extends UpdateArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    const q = this.clone() as T;
    return q._update(...args);
  }

  _update<T extends Query, Args extends UpdateArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    const [data, returning] = args;
    this.query.type = 'update';
    this.returnType = returning ? 'all' : 'rowCount';
    pushQueryValue(this, 'data', data);
    if (returning) {
      pushQueryValue(this, 'returning', returning);
    }
    return this as unknown as UpdateResult<T, Args>;
  }

  updateOrThrow<T extends Query, Args extends UpdateArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    const q = this.clone() as T;
    return q._updateOrThrow(...args);
  }

  _updateOrThrow<T extends Query, Args extends UpdateArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    this.query.throwOnNotFound = true;
    return this._update(...args) as unknown as UpdateResult<T, Args>;
  }

  increment<T extends Query, Args extends ChangeCountArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    return this.clone()._increment(...args) as unknown as UpdateResult<T, Args>;
  }

  _increment<T extends Query, Args extends ChangeCountArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    return applyCountChange(this, '+', args);
  }

  decrement<T extends Query, Args extends ChangeCountArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    return this.clone()._decrement(...args) as unknown as UpdateResult<T, Args>;
  }

  _decrement<T extends Query, Args extends ChangeCountArgs<T>>(
    this: T,
    ...args: Args
  ): UpdateResult<T, Args> {
    return applyCountChange(this, '-', args);
  }
}
