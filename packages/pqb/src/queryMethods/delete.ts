import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsVoid,
} from '../query';
import { ReturningArg } from './insert';
import { assignQueryValues } from '../queryDataUtils';

type DeleteResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends '*'
  ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
  : Returning extends (keyof T['shape'])[]
  ? SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsVoid<T>;

const del = <
  T extends Query,
  Returning extends ReturningArg<T> | undefined = undefined,
>(
  self: T,
  returning?: Returning,
): DeleteResult<T, Returning> => {
  return self.clone()._del(returning) as unknown as DeleteResult<T, Returning>;
};

const _del = <
  T extends Query,
  Returning extends ReturningArg<T> | undefined = undefined,
>(
  self: T,
  returning?: Returning,
): DeleteResult<T, Returning> => {
  const q = returning ? self._all() : self._exec();
  return assignQueryValues(q, {
    type: 'delete',
    returning: returning,
  }) as unknown as DeleteResult<T, Returning>;
};

export class Delete {
  del<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(this: T, returning?: Returning): DeleteResult<T, Returning> {
    return del(this, returning);
  }

  _del<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(this: T, returning?: Returning): DeleteResult<T, Returning> {
    return _del(this, returning);
  }

  delete<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(this: T, returning?: Returning): DeleteResult<T, Returning> {
    return del(this, returning);
  }

  _delete<
    T extends Query,
    Returning extends ReturningArg<T> | undefined = undefined,
  >(this: T, returning?: Returning): DeleteResult<T, Returning> {
    return _del(this, returning);
  }
}
