import { OrchidOrmInternalError } from '../errors';
import { QueryBase } from '../query';

export const getPrimaryKeys = (q: QueryBase) => {
  return (q.internal.primaryKeys ??= collectPrimaryKeys(q));
};

export const requirePrimaryKeys = (q: QueryBase, message: string) => {
  const primaryKeys = getPrimaryKeys(q);
  if (!primaryKeys.length) {
    throw new OrchidOrmInternalError(q, message);
  }
  return primaryKeys;
};

const collectPrimaryKeys = (q: QueryBase): string[] => {
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
