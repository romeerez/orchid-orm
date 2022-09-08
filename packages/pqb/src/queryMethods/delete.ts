import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsValue,
} from '../query';
import { ReturningArg } from './insert';
import {
  pushQueryValue,
  removeFromQuery,
  setQueryValue,
} from '../queryDataUtils';
import { IntegerColumn } from '../columnSchema';

type DeleteResult<
  T extends Query,
  Returning extends ReturningArg<T> | undefined,
> = Returning extends '*'
  ? SetQueryReturnsAll<AddQuerySelect<T, T['shape']>>
  : Returning extends (keyof T['shape'])[]
  ? SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Returning[number]>>>
  : SetQueryReturnsValue<T, IntegerColumn>;

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
  let q: Query;
  if (returning) {
    q = self._all();
  } else {
    q = self.toQuery();
    q.returnType = 'rowCount';
    removeFromQuery(q, 'take');
  }

  setQueryValue(q, 'type', 'delete');
  if (returning) {
    pushQueryValue(q, 'returning', returning);
  }
  return q as unknown as DeleteResult<T, Returning>;
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
