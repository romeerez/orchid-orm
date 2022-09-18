import {
  Query,
  QueryBase,
  SetQueryReturnsValue,
  SetQueryReturnsValueOptional,
} from '../query';
import { RelationQueryBase } from '../relations';
import { isRaw, RawExpression } from '../common';
import { removeFromQuery } from '../queryDataUtils';
import { addParserForRawExpression, processSelectArg } from './select';
import { getQueryAs } from '../utils';

export type ValueArg<T extends QueryBase> =
  | keyof T['selectable']
  | (RelationQueryBase & { returnType: 'value' | 'valueOrThrow' })
  | RawExpression;

type UnwrapRaw<
  T extends Query,
  Arg extends ValueArg<T>,
> = Arg extends RawExpression ? Arg['__column'] : Exclude<Arg, RawExpression>;

type ValueResult<
  T extends Query,
  Arg extends ValueArg<T>,
> = SetQueryReturnsValue<T, UnwrapRaw<T, Arg>>;

type ValueOptionalResult<
  T extends Query,
  Arg extends ValueArg<T>,
> = SetQueryReturnsValueOptional<T, UnwrapRaw<T, Arg>>;

const _value = <
  T extends Query,
  R extends 'value' | 'valueOrThrow',
  Arg extends ValueArg<T>,
>(
  q: T,
  returnType: R,
  arg: Arg,
): R extends 'value' ? ValueOptionalResult<T, Arg> : ValueResult<T, Arg> => {
  q.query.returnType = returnType;
  removeFromQuery(q, 'take');

  if (typeof arg === 'object' && isRaw(arg)) {
    addParserForRawExpression(q, 'value', arg);
    q.query.select = [arg];
  } else {
    q.query.select = [
      processSelectArg(
        q,
        getQueryAs(q),
        arg as Exclude<ValueArg<T>, RawExpression>,
      ),
    ];
  }

  return q as unknown as ValueResult<T, Arg> & ValueOptionalResult<T, Arg>;
};

export class QueryValue {
  value<T extends Query, Arg extends ValueArg<T>>(
    this: T,
    arg: Arg,
  ): ValueResult<T, Arg> {
    return this.clone()._value(arg);
  }

  _value<T extends Query, Arg extends ValueArg<T>>(
    this: T,
    arg: Arg,
  ): ValueResult<T, Arg> {
    return _value(this, 'valueOrThrow', arg);
  }

  valueOptional<T extends Query, Arg extends ValueArg<T>>(
    this: T,
    arg: Arg,
  ): ValueOptionalResult<T, Arg> {
    return this.clone()._valueOptional(arg);
  }

  _valueOptional<T extends Query, Arg extends ValueArg<T>>(
    this: T,
    arg: Arg,
  ): ValueOptionalResult<T, Arg> {
    return _value(this, 'value', arg);
  }
}
