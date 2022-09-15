import { Query, SetQueryReturnsAll, SetQueryReturnsRowCount } from '../query';

type DeleteResult<T extends Query> = T['hasSelect'] extends false
  ? SetQueryReturnsRowCount<T>
  : SetQueryReturnsAll<T>;

const del = <T extends Query>(self: T): DeleteResult<T> => {
  return self.clone()._del() as unknown as DeleteResult<T>;
};

const _del = <T extends Query>(q: T): DeleteResult<T> => {
  if (!q.query.select) {
    q.returnType = 'rowCount';
  }

  q.query.type = 'delete';
  return q as unknown as DeleteResult<T>;
};

export class Delete {
  del<T extends Query>(this: T): DeleteResult<T> {
    return del(this);
  }

  _del<T extends Query>(this: T): DeleteResult<T> {
    return _del(this);
  }

  delete<T extends Query>(this: T): DeleteResult<T> {
    return del(this);
  }

  _delete<T extends Query>(this: T): DeleteResult<T> {
    return _del(this);
  }
}
