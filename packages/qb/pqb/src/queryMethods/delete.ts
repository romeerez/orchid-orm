import { Query, SetQueryReturnsRowCount } from '../query';

export type DeleteMethodsNames = 'del' | '_del' | 'delete' | '_delete';

type DeleteArgs<T extends Query> = T['meta']['hasWhere'] extends true
  ? []
  : [never];

type DeleteResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? T
  : SetQueryReturnsRowCount<T>;

const del = <T extends Query>(self: T): DeleteResult<T> => {
  return _del(self.clone()) as unknown as DeleteResult<T>;
};

const _del = <T extends Query>(q: T): DeleteResult<T> => {
  if (!q.query.select) {
    q.query.returnType = 'rowCount';
  }

  q.query.type = 'delete';
  return q as unknown as DeleteResult<T>;
};

export class Delete {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  del<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return del(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _del<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return _del(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return del(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _delete<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return _del(this);
  }
}
