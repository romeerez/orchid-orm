import { toSnakeCase } from '../../../utils';

export const getTableNameInDb = (
  table: string | undefined,
  nameInDb: string | undefined,
  snakeCase: boolean | undefined,
): string | undefined =>
  table && (nameInDb || (snakeCase ? toSnakeCase(table) : table));
