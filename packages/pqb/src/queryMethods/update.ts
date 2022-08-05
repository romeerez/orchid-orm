import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsVoid,
} from '../query';
import { assignQueryValues } from '../queryDataUtils';
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
  Args extends UpdateArgs<T>,
> = Args[1] extends ReturningArg<T>
  ? Args[1] extends '*'
    ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
    : SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
  : SetQueryReturnsVoid<T>;

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
    return assignQueryValues(this, {
      type: 'update',
      data,
      returning,
    }) as unknown as UpdateResult<T, Args>;
  }
}
