import { ColumnType } from './columnType';
import { getRawSql, isRaw, raw } from '../common';
import { Query } from '../query';
import { makeRegexToFindInSql } from '../utils';
import {
  UpdatedAtDataInjector,
  UpdateQueryData,
  UpdateQueryDataItem,
} from '../sql';

export function timestamps<T extends ColumnType>(this: {
  timestamp(): T;
}): {
  createdAt: T & { hasDefault: true };
  updatedAt: T & { hasDefault: true };
} {
  return {
    createdAt: this.timestamp().default(raw('now()')),
    updatedAt: this.timestamp()
      .default(raw('now()'))
      .modifyQuery(addHookForUpdate),
  };
}

const updatedAtRegex = makeRegexToFindInSql('\\bupdatedAt\\b"?\\s*=');
const updateUpdatedAtItem = raw('"updatedAt" = now()');

const addHookForUpdate = (q: Query) => {
  const query = q.query as UpdateQueryData;
  if (query.updateData) query.updateData.push(updatedAtInjector);
  else query.updateData = [updatedAtInjector];
};

const updatedAtInjector: UpdatedAtDataInjector = (data) => {
  return checkIfDataHasUpdatedAt(data) ? undefined : updateUpdatedAtItem;
};

const checkIfDataHasUpdatedAt = (data: UpdateQueryDataItem[]) => {
  return data.some((item) => {
    if (isRaw(item)) {
      updatedAtRegex.lastIndex = 0;
      return updatedAtRegex.test(getRawSql(item));
    } else {
      return typeof item !== 'function' && item.updatedAt;
    }
  });
};
