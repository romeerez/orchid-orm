import { Query } from './query';

export type Then<Res> = <T extends Query>(
  this: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: Res) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
) => Promise<Res | never>;

export const thenAll: Then<unknown[]> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => result.rows)
    .then(resolve, reject);
};

export const thenOne: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .query(this.toSql())
    .then((result) => result.rows[0])
    .then(resolve, reject);
};

export const thenRows: Then<unknown[][]> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => result.rows)
    .then(resolve, reject);
};

export const thenValue: Then<unknown> = function (resolve, reject) {
  return this.adapter
    .arrays(this.toSql())
    .then((result) => result.rows[0]?.[0])
    .then(resolve, reject);
};

export const thenVoid: Then<void> = function (resolve, reject) {
  return this.adapter.query(this.toSql()).then(() => resolve?.(), reject);
};
