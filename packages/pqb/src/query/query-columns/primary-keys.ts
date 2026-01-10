import { OrchidOrmInternalError } from '../errors';
import { Query } from '../query';

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
  const { shape } = q.q;
  for (const key in shape) {
    if (shape[key].data.primaryKey) {
      primaryKeys.push(key);
    }
  }

  const pkey = q.internal.tableData.primaryKey;
  if (pkey) {
    primaryKeys.push(...pkey.columns);
  }

  return primaryKeys;
};
