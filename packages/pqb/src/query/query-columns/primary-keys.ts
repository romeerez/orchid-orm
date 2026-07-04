import { OrchidOrmInternalError } from '../errors';
import { Query } from '../query';
import { ColumnsShape } from '../../columns';

export const getPrimaryKeys = (q: Query) => {
  return (q.internal.primaryKeys ??= collectPrimaryKeys(q));
};

export const requirePrimaryKeys = (q: Query, message: string) => {
  const primaryKeys = getPrimaryKeys(q);
  if (!primaryKeys.length) {
    throw new OrchidOrmInternalError(q, message);
  }
  return primaryKeys;
};

const collectPrimaryKeys = (q: Query): string[] => {
  const primaryKeys = [];
  const { shape } = q;
  for (const key in shape) {
    if ((shape as ColumnsShape)[key].data.primaryKey) {
      primaryKeys.push(key);
    }
  }

  const pkey = q.internal.tableData.primaryKey;
  if (pkey) {
    primaryKeys.push(...pkey.columns);
  }

  return primaryKeys;
};
