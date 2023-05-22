import { Query } from '../query';
import { pushQueryValue } from '../queryDataUtils';

export type BeforeHook<T extends Query = Query> = (
  query: T,
) => void | Promise<void>;

export type AfterHook<T extends Query = Query> = (
  query: T,
  data: unknown,
) => void | Promise<void>;

export type BeforeHookKey =
  | 'beforeQuery'
  | 'beforeCreate'
  | 'beforeUpdate'
  | 'beforeSave'
  | 'beforeDelete';

export type AfterHookKey =
  | 'afterQuery'
  | 'afterCreate'
  | 'afterUpdate'
  | 'afterSave'
  | 'afterDelete';

export const addQueryHook = <T extends Query>(
  q: T,
  ...[key, cb]: [BeforeHookKey, BeforeHook<T>] | [AfterHookKey, AfterHook<T>]
): T => {
  if (key.endsWith('Save')) {
    const when = key.slice(0, -4);
    pushQueryValue(q, when + 'Update', cb);
    pushQueryValue(q, when + 'Create', cb);
  } else {
    pushQueryValue(q, key, cb);
  }
  return q;
};

export class QueryHooks {
  beforeQuery<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return this.clone()._beforeQuery(cb);
  }
  _beforeQuery<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return addQueryHook(this, 'beforeQuery', cb);
  }

  afterQuery<T extends Query>(this: T, cb: AfterHook<T>): T {
    return this.clone()._afterQuery(cb);
  }
  _afterQuery<T extends Query>(this: T, cb: AfterHook<T>): T {
    return addQueryHook(this, 'afterQuery', cb);
  }

  beforeCreate<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return this.clone()._beforeCreate(cb);
  }
  _beforeCreate<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return addQueryHook(this, 'beforeCreate', cb);
  }

  afterCreate<T extends Query>(this: T, cb: AfterHook<T>): T {
    return this.clone()._afterCreate(cb);
  }
  _afterCreate<T extends Query>(this: T, cb: AfterHook<T>): T {
    return addQueryHook(this, 'afterCreate', cb);
  }

  beforeUpdate<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return this.clone()._beforeUpdate(cb);
  }
  _beforeUpdate<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return addQueryHook(this, 'beforeUpdate', cb);
  }

  afterUpdate<T extends Query>(this: T, cb: AfterHook<T>): T {
    return this.clone()._afterUpdate(cb);
  }
  _afterUpdate<T extends Query>(this: T, cb: AfterHook<T>): T {
    return addQueryHook(this, 'afterUpdate', cb);
  }

  beforeSave<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return this.clone()._beforeSave(cb);
  }
  _beforeSave<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return addQueryHook(this, 'beforeSave', cb);
  }

  afterSave<T extends Query>(this: T, cb: AfterHook<T>): T {
    return this.clone()._afterSave(cb);
  }
  _afterSave<T extends Query>(this: T, cb: AfterHook<T>): T {
    return addQueryHook(this, 'afterSave', cb);
  }

  beforeDelete<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return this.clone()._beforeDelete(cb);
  }
  _beforeDelete<T extends Query>(this: T, cb: BeforeHook<T>): T {
    return addQueryHook(this, 'beforeDelete', cb);
  }

  afterDelete<T extends Query>(this: T, cb: AfterHook<T>): T {
    return this.clone()._afterDelete(cb);
  }
  _afterDelete<T extends Query>(this: T, cb: AfterHook<T>): T {
    return addQueryHook(this, 'afterDelete', cb);
  }
}
