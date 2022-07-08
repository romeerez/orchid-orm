import { Operators } from '../operators';

export type _ = Record<never, never>;

const addData = <T extends ColumnType, Update extends _>(
  self: T,
  data: Update,
): T & { data: T['data'] & Update } => {
  const cloned = new (self.constructor as new () => T)();
  cloned.data = { ...self.data, data };
  return cloned as T & { data: T['data'] & Update };
};

export class ColumnType<
  T = unknown,
  D extends string = string,
  Ops extends Operators = Operators,
> {
  type!: T;
  dataType!: D;
  operators!: Ops;
  data = {} as _;
}

export class IntegerColumn extends ColumnType<
  number,
  'integer',
  typeof Operators.number
> {
  data = {} as {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    multipleOf?: number;
  };

  lt<T extends this, Value extends number>(
    this: T,
    value: Value,
  ): T & { data: Omit<T['data'], 'lt'> & { lt: Value } } {
    return addData(this, { lt: value });
  }

  lte<T extends this, Value extends number>(
    this: T,
    value: Value,
  ): T & { data: Omit<T['data'], 'lte'> & { lte: Value } } {
    return addData(this, { lte: value });
  }

  max<T extends this, Value extends number>(
    this: T,
    value: Value,
  ): T & { data: Omit<T['data'], 'lte'> & { lte: Value } } {
    return addData(this, { lte: value });
  }

  gt<T extends this, Value extends number>(
    this: T,
    value: Value,
  ): T & { data: Omit<T['data'], 'gt'> & { gt: Value } } {
    return addData(this, { gt: value });
  }
}

export const columnTypes = {
  integer: () => new IntegerColumn(),
};

const int = columnTypes.integer();
const ltThan5 = int.lt(5);
console.log(ltThan5.data.lt);
