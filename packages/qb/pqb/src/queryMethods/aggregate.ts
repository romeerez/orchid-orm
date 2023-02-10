import { raw } from '../raw';
import { AddQuerySelect, Query, SetQueryReturnsValue } from '../query';
import { pushQueryValue } from '../queryDataUtils';
import {
  ArrayColumn,
  BooleanColumn,
  ColumnType,
  IntegerColumn,
  NullableColumn,
  NumberColumn,
  StringColumn,
} from '../columns';
import {
  BooleanExpression,
  CoalesceString,
  Expression,
  ExpressionOutput,
  NumberExpression,
  StringExpression,
} from '../utils';
import { OrderArg, WindowArgDeclaration } from './queryMethods';
import { WhereArg } from './where';
import { addParserToQuery } from './select';
import { SelectItem } from '../sql';
import { getValueKey } from './get';

const allColumns = raw('*');

export type AggregateArg<T extends Query> =
  | Expression<T>
  | Record<string, Expression<T>>
  | [Expression<T>, string];

export type AggregateOptions<
  T extends Query = Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  As extends string | undefined = any,
> = {
  as?: As;
  distinct?: boolean;
  order?: OrderArg<T> | OrderArg<T>[];
  filter?: WhereArg<T>;
  filterOr?: WhereArg<T>[];
  withinGroup?: boolean;
  over?: keyof T['windows'] | WindowArgDeclaration<T>;
};

// 1 in the name means only methods which takes 1 argument are listed here
// only such one argument methods are available in .having method
export type Aggregate1ArgumentTypes<
  T extends Query = Query,
  C extends ColumnType = ColumnType,
> = {
  count: Expression<T, C>;
  avg: NumberExpression<T, C>;
  min: Expression<T, C>;
  max: Expression<T, C>;
  sum: NumberExpression<T, C>;
  bitAnd: NumberExpression<T, C>;
  bitOr: NumberExpression<T, C>;
  boolAnd: BooleanExpression<T, C>;
  boolOr: BooleanExpression<T, C>;
  every: BooleanExpression<T, C>;
  jsonAgg: Expression<T, C>;
  jsonbAgg: Expression<T, C>;
  xmlAgg: Expression<T, C>;
};

export const aggregate1FunctionNames = {
  count: 'count',
  avg: 'avg',
  min: 'min',
  max: 'max',
  sum: 'sum',
  bitAnd: 'bit_and',
  bitOr: 'bit_or',
  boolAnd: 'bool_and',
  boolOr: 'bool_or',
  every: 'every',
  jsonAgg: 'json_agg',
  jsonbAgg: 'jsonb_agg',
  xmlAgg: 'xmlagg',
} as const;

export type SelectAgg<
  T extends Query,
  Func extends string,
  As extends string | undefined,
  Value extends ColumnType,
> = AddQuerySelect<T, Record<CoalesceString<As, Func>, Value>>;

type AT1<T extends Query> = Aggregate1ArgumentTypes<T>;

export type WindowFunctionOptions<
  T extends Query = Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  As extends string | undefined = any,
> = { as?: As } & WindowArgDeclaration<T>;

const buildAggregateSelectItem = <T extends Query>(
  functionName: string,
  arg: AggregateArg<T>,
  options?: AggregateOptions<T>,
) => {
  return {
    function: functionName,
    arg,
    options: {
      ...options,
      order: options?.order
        ? Array.isArray(options.order)
          ? options.order
          : [options.order]
        : undefined,
      filter: options?.filter,
      filterOr: options?.filterOr,
    },
  };
};

const parseIntColumn = new IntegerColumn().parse((input) =>
  parseInt(input as unknown as string),
);

const parseIntOrNullColumn = new IntegerColumn().parse((input) =>
  input === null ? null : parseInt(input as unknown as string),
);

const get = <T extends Query, Column extends ColumnType>(
  q: Query,
): SetQueryReturnsValue<T, Column> => {
  q.query.returnType = 'valueOrThrow';

  const select = q.query.select as SelectItem[];
  if (select.length > 1) {
    select[0] = select[select.length - 1];
    select.length = 1;
  }

  return q as unknown as SetQueryReturnsValue<T, Column>;
};

export class Aggregate {
  selectAgg<
    T extends Query,
    Func extends string,
    As extends string | undefined,
    Value extends ColumnType,
  >(
    this: T,
    functionName: Func,
    arg: AggregateArg<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, Func, As, Value> {
    return this.clone()._selectAgg(functionName, arg, options) as SelectAgg<
      T,
      Func,
      As,
      Value
    >;
  }

  _selectAgg<
    T extends Query,
    Func extends string,
    As extends string | undefined,
    Value extends ColumnType,
  >(
    this: T,
    functionName: Func,
    arg: AggregateArg<T>,
    options?: AggregateOptions<T, As>,
    columnType?: ColumnType,
  ): SelectAgg<T, Func, As, Value> {
    pushQueryValue(
      this,
      'select',
      buildAggregateSelectItem<T>(functionName, arg, options),
    );

    if (columnType?.parseFn) {
      addParserToQuery(this.query, getValueKey, columnType.parseFn);

      addParserToQuery(
        this.query,
        options?.as || functionName,
        columnType.parseFn,
      );
    }

    return this as unknown as SelectAgg<T, Func, As, Value>;
  }

  count<T extends Query>(
    this: T,
    arg?: AT1<T>['count'] | '*',
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> & { isCount: true } {
    return this.clone()._count(arg, options);
  }

  _count<T extends Query>(
    this: T,
    arg: AT1<T>['count'] | '*' = '*',
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NumberColumn> & { isCount: true } {
    return get<T, NumberColumn>(
      this._selectCount(arg, options),
    ) as unknown as SetQueryReturnsValue<T, NumberColumn> & { isCount: true };
  }

  selectCount<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg?: AT1<T>['count'] | '*',
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'count', As, NumberColumn> {
    return this.clone()._selectCount(arg, options);
  }

  _selectCount<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: AT1<T>['count'] | '*' = '*',
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'count', As, NumberColumn> {
    return this._selectAgg(
      aggregate1FunctionNames.count,
      arg === '*' ? allColumns : arg,
      options,
      parseIntColumn,
    );
  }

  avg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['avg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._avg(arg, options);
  }

  _avg<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['avg'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(this._selectAvg(arg, options));
  }

  selectAvg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'avg', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectAvg(arg, options);
  }

  _selectAvg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'avg', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(
      aggregate1FunctionNames.avg,
      arg,
      options,
      parseIntOrNullColumn,
    );
  }

  min<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['min'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._min(arg, options);
  }

  _min<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['min'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(this._selectMin(arg, options));
  }

  selectMin<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'min', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectMin(arg, options);
  }

  _selectMin<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'min', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(
      aggregate1FunctionNames.min,
      arg,
      options,
      parseIntOrNullColumn,
    );
  }

  max<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['max'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._max(arg, options);
  }

  _max<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['max'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(this._selectMax(arg, options));
  }

  selectMax<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'max', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectMax(arg, options);
  }

  _selectMax<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'max', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(
      aggregate1FunctionNames.max,
      arg,
      options,
      parseIntOrNullColumn,
    );
  }

  sum<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['sum'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._sum(arg, options);
  }

  _sum<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['sum'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(this._selectSum(arg, options));
  }

  selectSum<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'sum', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectSum(arg, options);
  }

  _selectSum<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'sum', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(
      aggregate1FunctionNames.sum,
      arg,
      options,
      parseIntOrNullColumn,
    );
  }

  bitAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._bitAnd(arg, options);
  }

  _bitAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(
      this._selectBitAnd(arg, options),
    );
  }

  selectBitAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_and', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectBitAnd(arg, options);
  }

  _selectBitAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_and', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(aggregate1FunctionNames.bitAnd, arg, options);
  }

  bitOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return this.clone()._bitOr(arg, options);
  }

  _bitOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['bitOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<NumberColumn>> {
    return get<T, NullableColumn<NumberColumn>>(
      this._selectBitOr(arg, options),
    );
  }

  selectBitOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_or', As, NullableColumn<NumberColumn>> {
    return this.clone()._selectBitOr(arg, options);
  }

  _selectBitOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bit_or', As, NullableColumn<NumberColumn>> {
    return this._selectAgg(aggregate1FunctionNames.bitOr, arg, options);
  }

  boolAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return this.clone()._boolAnd(arg, options);
  }

  _boolAnd<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolAnd'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return get<T, NullableColumn<BooleanColumn>>(
      this._selectBoolAnd(arg, options),
    );
  }

  selectBoolAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_and', As, NullableColumn<BooleanColumn>> {
    return this.clone()._selectBoolAnd(arg, options);
  }

  _selectBoolAnd<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_and', As, NullableColumn<BooleanColumn>> {
    return this._selectAgg(aggregate1FunctionNames.boolAnd, arg, options);
  }

  boolOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return this.clone()._boolOr(arg, options);
  }

  _boolOr<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['boolOr'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return get<T, NullableColumn<BooleanColumn>>(
      this._selectBoolOr(arg, options),
    );
  }

  selectBoolOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_or', As, NullableColumn<BooleanColumn>> {
    return this.clone()._selectBoolOr(arg, options);
  }

  _selectBoolOr<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'bool_or', As, NullableColumn<BooleanColumn>> {
    return this._selectAgg(aggregate1FunctionNames.boolOr, arg, options);
  }

  every<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['every'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return this.clone()._every(arg, options);
  }

  _every<T extends Query>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['every'],
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<BooleanColumn>> {
    return get<T, NullableColumn<BooleanColumn>>(
      this._selectEvery(arg, options),
    );
  }

  selectEvery<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'every', As, NullableColumn<BooleanColumn>> {
    return this.clone()._selectEvery(arg, options);
  }

  _selectEvery<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Expression<T>,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'every', As, NullableColumn<BooleanColumn>> {
    return this._selectAgg(aggregate1FunctionNames.every, arg, options);
  }

  jsonAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['jsonAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this.clone()._jsonAgg(arg, options);
  }

  _jsonAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['jsonAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return get<T, NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>>(
      this._selectJsonAgg(arg, options),
    );
  }

  selectJsonAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'json_agg',
    As,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this.clone()._selectJsonAgg(arg, options);
  }

  _selectJsonAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'json_agg',
    As,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this._selectAgg(aggregate1FunctionNames.jsonAgg, arg, options);
  }

  jsonbAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg'],
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this.clone()._jsonbAgg(arg, options);
  }

  _jsonbAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg'],
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return get<T, NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>>(
      this._selectJsonbAgg(arg, options),
    );
  }

  selectJsonbAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'jsonb_agg',
    As,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this.clone()._selectJsonbAgg(arg, options);
  }

  _selectJsonbAgg<
    T extends Query,
    Expr extends Aggregate1ArgumentTypes<T>['jsonbAgg'],
    As extends string | undefined = undefined,
  >(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'jsonb_agg',
    As,
    NullableColumn<ArrayColumn<ExpressionOutput<T, Expr>>>
  > {
    return this._selectAgg(aggregate1FunctionNames.jsonbAgg, arg, options);
  }

  xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<StringColumn>> {
    return this.clone()._xmlAgg(arg, options);
  }

  _xmlAgg<T extends Query, Expr extends Aggregate1ArgumentTypes<T>['xmlAgg']>(
    this: T,
    arg: Expr,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<StringColumn>> {
    return get<T, NullableColumn<StringColumn>>(
      this._selectXmlAgg(arg, options),
    );
  }

  selectXmlAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['xmlAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'xmlagg', As, NullableColumn<StringColumn>> {
    return this.clone()._selectXmlAgg(arg, options);
  }

  _selectXmlAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: Aggregate1ArgumentTypes<T>['xmlAgg'],
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'xmlagg', As, NullableColumn<StringColumn>> {
    return this._selectAgg(aggregate1FunctionNames.xmlAgg, arg, options);
  }

  jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this.clone()._jsonObjectAgg(obj, options);
  }

  _jsonObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return get<
      T,
      NullableColumn<
        ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
      >
    >(this._selectJsonObjectAgg(obj, options));
  }

  selectJsonObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'json_object_agg',
    As,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this.clone()._selectJsonObjectAgg(obj, options);
  }

  _selectJsonObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'json_object_agg',
    As,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this._selectAgg('json_object_agg', obj, options);
  }

  jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this.clone()._jsonbObjectAgg(obj, options);
  }

  _jsonbObjectAgg<T extends Query, Obj extends Record<string, Expression<T>>>(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<
    T,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return get<
      T,
      NullableColumn<
        ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
      >
    >(this._selectJsonbObjectAgg(obj, options));
  }

  selectJsonbObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'jsonb_object_agg',
    As,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this.clone()._selectJsonbObjectAgg(obj, options);
  }

  _selectJsonbObjectAgg<
    T extends Query,
    Obj extends Record<string, Expression<T>>,
    As extends string | undefined = undefined,
  >(
    this: T,
    obj: Obj,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<
    T,
    'jsonb_object_agg',
    As,
    NullableColumn<
      ColumnType<{ [K in keyof Obj]: ExpressionOutput<T, Obj[K]>['type'] }>
    >
  > {
    return this._selectAgg('jsonb_object_agg', obj, options);
  }

  stringAgg<T extends Query>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<StringColumn>> {
    return this.clone()._stringAgg(arg, delimiter, options);
  }

  _stringAgg<T extends Query>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T>,
  ): SetQueryReturnsValue<T, NullableColumn<StringColumn>> {
    return get<T, NullableColumn<StringColumn>>(
      this._selectStringAgg(arg, delimiter, options),
    );
  }

  selectStringAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'string_agg', As, NullableColumn<StringColumn>> {
    return this.clone()._selectStringAgg(arg, delimiter, options);
  }

  _selectStringAgg<T extends Query, As extends string | undefined = undefined>(
    this: T,
    arg: StringExpression<T>,
    delimiter: string,
    options?: AggregateOptions<T, As>,
  ): SelectAgg<T, 'string_agg', As, NullableColumn<StringColumn>> {
    return this._selectAgg('string_agg', [arg, delimiter], options);
  }
}
