import {
  AddQuerySelect,
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsVoid,
} from '../query';
import { setQueryValue } from '../queryDataUtils';

type OptionalKeys<T extends Query> = {
  [K in keyof T['shape']]: T['shape'][K]['isPrimaryKey'] extends true
    ? K
    : T['shape'][K]['isNullable'] extends true
    ? K
    : never;
}[keyof T['shape']];

type InsertData<T extends Query> = Omit<T['type'], OptionalKeys<T>> & {
  [K in OptionalKeys<T>]?: T['shape'][K]['type'];
};

type InsertReturning<T extends Query> = (keyof T['shape'])[];

type InsertArgs<T extends Query> = [
  data: InsertData<T> | InsertData<T>[],
  returning?: InsertReturning<T>,
];

type InsertResult<
  T extends Query,
  Args extends InsertArgs<T>,
> = Args[1] extends (keyof T['shape'])[]
  ? Args[0] extends Array<unknown>
    ? SetQueryReturnsAll<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
    : SetQueryReturnsOne<AddQuerySelect<T, Pick<T['shape'], Args[1][number]>>>
  : SetQueryReturnsVoid<T>;

export class Insert {
  insert<T extends Query, Args extends InsertArgs<T>>(
    this: T,
    ...args: Args
  ): InsertResult<T, Args> {
    return this.clone()._insert(...args) as unknown as InsertResult<T, Args>;
  }

  _insert<T extends Query, Args extends InsertArgs<T>>(
    this: T,
    ...args: Args
  ): InsertResult<T, Args> {
    const [data, returning] = args;
    return setQueryValue(this._take(), 'insert', {
      data,
      returning: returning as string[] | undefined,
    }) as unknown as InsertResult<T, Args>;
  }
}
