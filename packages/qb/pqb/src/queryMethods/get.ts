import {
  Query,
  SetQueryReturnsValue,
  SetQueryReturnsValueOptional,
} from '../query';
import { addParserForRawExpression, processSelectArg } from './select';
import { RawExpression, ColumnTypeBase, StringKey } from 'orchid-core';
import { SelectQueryData } from '../sql';
import { QueryBase } from '../queryBase';

export type GetArg<T extends QueryBase> =
  | StringKey<keyof T['selectable']>
  | RawExpression;

type UnwrapRaw<
  T extends Query,
  Arg extends GetArg<T>,
> = Arg extends RawExpression ? Arg['__column'] : Exclude<Arg, RawExpression>;

type GetResult<T extends Query, Arg extends GetArg<T>> = SetQueryReturnsValue<
  T,
  UnwrapRaw<T, Arg>
>;

type GetOptionalResult<
  T extends Query,
  Arg extends GetArg<T>,
> = SetQueryReturnsValueOptional<T, UnwrapRaw<T, Arg>>;

export type getValueKey = typeof getValueKey;
export const getValueKey = Symbol('get');

const _get = <
  T extends Query,
  R extends 'value' | 'valueOrThrow',
  Arg extends GetArg<T>,
>(
  q: T,
  returnType: R,
  arg: Arg,
): R extends 'value' ? GetOptionalResult<T, Arg> : GetResult<T, Arg> => {
  q.query.returnType = returnType;

  if (typeof arg === 'string') {
    let type = q.query.shape[arg] as ColumnTypeBase | undefined;
    if (type) {
    } else {
      const index = arg.indexOf('.');
      if (index !== -1) {
        const table = arg.slice(0, index);
        const column = arg.slice(index + 1);

        if (table === (q.query.as || q.table)) {
          type = q.query.shape[column];
        } else {
          type = q.query.joinedShapes?.[table]?.[column];
        }
      }
    }

    (q.query as SelectQueryData)[getValueKey] = type;

    q.query.select = [
      processSelectArg(
        q,
        q.query.as || q.table,
        arg as unknown as Exclude<GetArg<T>, RawExpression>,
        getValueKey,
      ),
    ];
  } else {
    (q.query as SelectQueryData)[getValueKey] = arg.__column;
    addParserForRawExpression(q, getValueKey, arg);
    q.query.select = [arg];
  }

  return q as unknown as GetResult<T, Arg> & GetOptionalResult<T, Arg>;
};

export class QueryGet {
  get<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResult<T, Arg> {
    return this.clone()._get(arg);
  }

  _get<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetResult<T, Arg> {
    return _get(this, 'valueOrThrow', arg);
  }

  getOptional<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetOptionalResult<T, Arg> {
    return this.clone()._getOptional(arg);
  }

  _getOptional<T extends Query, Arg extends GetArg<T>>(
    this: T,
    arg: Arg,
  ): GetOptionalResult<T, Arg> {
    return _get(this, 'value', arg);
  }
}
