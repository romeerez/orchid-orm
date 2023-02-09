import { Query } from '../query';
import { pushQueryValue } from '../queryDataUtils';

export type BeforeCallback<T extends Query = Query> = (
  query: T,
) => void | Promise<void>;

export type AfterCallback<T extends Query = Query> = (
  query: T,
  data: unknown,
) => void | Promise<void>;

export class QueryCallbacks {
  beforeQuery<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return this.clone()._beforeQuery(cb);
  }
  _beforeQuery<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return pushQueryValue(this, 'beforeQuery', cb);
  }

  afterQuery<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return this.clone()._afterQuery(cb);
  }
  _afterQuery<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return pushQueryValue(this, 'afterQuery', cb);
  }

  beforeCreate<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return this.clone()._beforeCreate(cb);
  }
  _beforeCreate<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return pushQueryValue(this, 'beforeCreate', cb);
  }

  afterCreate<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return this.clone()._afterCreate(cb);
  }
  _afterCreate<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return pushQueryValue(this, 'afterCreate', cb);
  }

  beforeUpdate<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return this.clone()._beforeUpdate(cb);
  }
  _beforeUpdate<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return pushQueryValue(this, 'beforeUpdate', cb);
  }

  afterUpdate<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return this.clone()._afterUpdate(cb);
  }
  _afterUpdate<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return pushQueryValue(this, 'afterUpdate', cb);
  }

  beforeDelete<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return this.clone()._beforeDelete(cb);
  }
  _beforeDelete<T extends Query>(this: T, cb: BeforeCallback<T>): T {
    return pushQueryValue(this, 'beforeDelete', cb);
  }

  afterDelete<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return this.clone()._afterDelete(cb);
  }
  _afterDelete<T extends Query>(this: T, cb: AfterCallback<T>): T {
    return pushQueryValue(this, 'afterDelete', cb);
  }
}
