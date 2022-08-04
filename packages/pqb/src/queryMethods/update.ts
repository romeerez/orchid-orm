import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsVoid,
} from '../query';
import { setQueryValue } from '../queryDataUtils';
import { RawExpression } from '../common';

type UpdateData<T extends Query> = {
  [K in keyof T['type']]?: T['type'][K] | RawExpression;
};

type UpdateReturning<T extends Query> = (keyof T['shape'])[] | '*';

type UpdateArgs<T extends Query> = [
  data: UpdateData<T> | RawExpression,
  returning?: UpdateReturning<T>,
];

type UpdateResult<
  T extends Query,
  Args extends UpdateArgs<T>,
> = Args[1] extends UpdateReturning<T>
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
    return setQueryValue(this._all(), 'update', {
      data,
      returning: returning as string[] | undefined,
    }) as unknown as UpdateResult<T, Args>;
  }
}
