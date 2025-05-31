import {
  ArrayColumn,
  BigIntColumn,
  BigSerialColumn,
  BitColumn,
  BitVaryingColumn,
  BooleanColumn,
  BoxColumn,
  ByteaColumn,
  CidrColumn,
  CircleColumn,
  CitextColumn,
  ColumnsShape,
  ColumnType,
  CreateData,
  CreateSelf,
  DateColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  EnumColumn,
  getPrimaryKeys,
  InetColumn,
  IntegerColumn,
  IntervalColumn,
  JSONColumn,
  JSONTextColumn,
  LineColumn,
  LsegColumn,
  MacAddr8Column,
  MacAddrColumn,
  MoneyColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  PostgisGeographyPointColumn,
  Query,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
  StringColumn,
  TextColumn,
  TimeColumn,
  TimestampColumn,
  TimestampTZColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  VarCharColumn,
  VirtualColumn,
  XMLColumn,
} from 'pqb';
import {
  BaseNumberData,
  ColumnSchemaConfig,
  ColumnShapeOutput,
  ColumnTypeBase,
  emptyObject,
  EmptyObject,
  MaybePromise,
  PickQueryShape,
  RecordUnknown,
  StringTypeData,
} from 'orchid-core';
import { faker } from '@faker-js/faker';
import randexp from 'randexp';

type FakeDataFn = (sequence: number) => unknown;

interface FakeDataDefineFns {
  [K: string]: (column: ColumnTypeBase) => FakeDataFn;
}

interface FakeDataFns {
  [K: string]: FakeDataFn;
}

export interface FactoryConfig {
  sequence?: number;
  sequenceDistance?: number;
  maxTextLength?: number;
  fakeDataForTypes?: FakeDataDefineFns;
}

type FactoryExtend<T extends PickQueryShape> = {
  [K in keyof T['shape']]?: (sequence: number) => T['shape'][K]['outputType'];
};

export interface TableFactoryConfig<T extends PickQueryShape>
  extends FactoryConfig {
  extend?: FactoryExtend<T>;
}

export interface OrmFactoryConfig<T> extends FactoryConfig {
  extend?: {
    [K in keyof T]?: T[K] extends PickQueryShape ? FactoryExtend<T[K]> : never;
  };
}

type metaKey = typeof metaKey;
const metaKey = Symbol('meta');

type Result<
  T extends TestFactory,
  Data,
  Omitted = Omit<Data, keyof T[metaKey]['omit']>,
> = EmptyObject extends T[metaKey]['pick']
  ? Omitted
  : Pick<
      Omitted,
      {
        [K in keyof Omitted]: K extends keyof T[metaKey]['pick'] ? K : never;
      }[keyof Omitted]
    >;

type BuildArg<T extends TestFactory> = {
  [K in keyof T[metaKey]['type']]?:
    | T[metaKey]['type'][K]
    | ((sequence: number) => T[metaKey]['type'][K]);
} & RecordUnknown;

type BuildResult<T extends TestFactory, Data extends BuildArg<T>> = Result<
  T,
  BuildArg<T> extends Data
    ? T[metaKey]['type']
    : T[metaKey]['type'] & {
        [K in keyof Data]: Data[K] extends () => void
          ? ReturnType<Data[K]>
          : Data[K];
      }
>;

export type CreateArg<T extends TestFactory> = CreateData<{
  [K in keyof T['table']]: K extends 'inputType'
    ? {
        [K in keyof T['table']['inputType']]?:
          | T['table']['inputType'][K]
          | ((sequence: number) => MaybePromise<T['table']['inputType'][K]>);
      }
    : T['table'][K];
}>;

type CreateResult<T extends TestFactory> = Result<
  T,
  ColumnShapeOutput<T['table']['shape']>
>;

const omit = <T, Keys extends RecordUnknown>(
  obj: T,
  keys: Keys,
): Omit<T, keyof Keys> => {
  const res = { ...obj };
  Object.keys(keys).forEach((key) => {
    delete (res as unknown as RecordUnknown)[key];
  });
  return res;
};

const pick = <T, Keys extends RecordUnknown>(
  obj: T,
  keys: Keys,
): Pick<T, { [K in keyof T]: K extends keyof Keys ? K : never }[keyof T]> => {
  const res = {} as T;
  Object.keys(keys).forEach((key) => {
    const value = (obj as unknown as RecordUnknown)[key];
    if (value !== undefined) {
      (res as unknown as RecordUnknown)[key] = value;
    }
  });
  return res;
};

const makeBuild = <T extends TestFactory, Data extends BuildArg<T>>(
  factory: T,
  data: RecordUnknown,
  omitValues: Record<PropertyKey, true>,
  pickValues: Record<PropertyKey, true>,
  arg?: Data,
) => {
  let { fns } = factory;
  let allData = arg ? { ...data, ...arg } : data;

  if (omitValues) {
    fns = omit(fns, omitValues);
    allData = omit(allData, omitValues);
  }

  if (pickValues && Object.keys(pickValues).length) {
    fns = pick(fns, pickValues);
    allData = pick(allData, pickValues);
  }

  return (arg?: BuildArg<T>) => {
    const data = arg ? { ...allData, ...arg } : allData;
    const sequence = factory.sequence++;

    const result: RecordUnknown = {};
    for (const key in fns) {
      result[key] = fns[key](sequence);
    }

    for (const key in data) {
      const value = (data as RecordUnknown)[key];
      if (typeof value === 'function') {
        result[key] = value(sequence);
      } else {
        result[key] = value;
      }
    }

    return result as BuildResult<T, Data>;
  };
};

const processCreateData = <T extends TestFactory, Data extends CreateArg<T>>(
  factory: T,
  data: RecordUnknown,
  arg?: Data,
) => {
  const { fns } = factory;

  const pick: Record<string, true> = {};
  for (const key in fns) {
    pick[key] = true;
  }

  for (const key of getPrimaryKeys(factory.table)) {
    const item = factory.table.shape[key] as ColumnTypeBase;

    if ('identity' in item.data || item.dataType.includes('serial')) {
      delete pick[key];
    }
  }

  const shared: RecordUnknown = {};

  const allData = (arg ? { ...data, ...arg } : data) as RecordUnknown;

  for (const key in allData) {
    delete pick[key];
    const value = allData[key];
    if (typeof value === 'function') {
      fns[key] = value as () => unknown;
    } else {
      shared[key] = value;
    }
  }

  return async (arg?: CreateArg<T>) => {
    const { sequence } = factory;
    factory.sequence++;

    const result = { ...shared };
    for (const key in pick) {
      result[key] = fns[key](sequence);
    }

    if (arg) {
      for (const key in arg) {
        if (typeof arg[key] === 'function') {
          result[key] = (arg[key] as (sequence: number) => unknown)(sequence);
        } else {
          result[key] = arg[key];
        }
      }
    } else {
      const promises: Promise<void>[] = [];

      for (const key in fns) {
        if (key in result) continue;

        promises.push(
          new Promise(async (resolve, reject) => {
            try {
              result[key] = await fns[key](sequence);
              resolve();
            } catch (err) {
              reject(err);
            }
          }),
        );
      }

      await Promise.all(promises);
    }

    return result as CreateData<T['table']>;
  };
};

export class TestFactory<
  Q extends CreateSelf = CreateSelf,
  Type extends EmptyObject = EmptyObject,
> {
  sequence: number;
  private readonly omitValues: Record<PropertyKey, true> = {};
  private readonly pickValues: Record<PropertyKey, true> = {};
  private readonly data: RecordUnknown = {};

  [metaKey]!: {
    type: Type;
    omit: EmptyObject;
    pick: EmptyObject;
  };

  constructor(
    public table: Q,
    public fns: FakeDataFns,
    options: TableFactoryConfig<PickQueryShape> = {},
  ) {
    if (options.sequence !== undefined) {
      this.sequence = options.sequence;
    } else {
      let workerId = parseInt(process.env.JEST_WORKER_ID as string);
      if (isNaN(workerId)) workerId = 1;
      this.sequence = (workerId - 1) * (options.sequenceDistance ?? 1000) + 1;
    }
  }

  set<
    T extends this,
    Meta extends { type: EmptyObject },
    Data extends {
      [K in keyof Meta['type']]?: Meta['type'][K] | (() => Meta['type'][K]);
    } & RecordUnknown,
  >(
    this: T & { [metaKey]: Meta },
    data: Data,
  ): T & { [metaKey]: Meta & { type: Data } } {
    return Object.assign(Object.create(this), {
      data: { ...this.data, ...data },
    });
  }

  omit<T extends this, Keys extends { [K in keyof T[metaKey]['type']]?: true }>(
    this: T,
    keys: Keys,
  ): T & { [metaKey]: T[metaKey] & { omit: Keys } } {
    return Object.assign(Object.create(this), {
      omitValues: { ...this.omitValues, ...keys },
    });
  }

  pick<T extends this, Keys extends { [K in keyof T[metaKey]['type']]?: true }>(
    this: T,
    keys: Keys,
  ): T & { [metaKey]: T[metaKey] & { pick: Keys } } {
    return Object.assign(Object.create(this), {
      pickValues: { ...this.pickValues, ...keys },
    });
  }

  build<T extends this, Data extends BuildArg<T>>(
    this: T,
    data?: Data,
  ): BuildResult<T, Data> {
    // TODO: consider memoizing the base case
    const build = makeBuild(
      this,
      this.data,
      this.omitValues,
      this.pickValues,
      data,
    );
    return build();
  }

  buildList<T extends this, Data extends BuildArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): BuildResult<T, Data>[] {
    const build = makeBuild(
      this,
      this.data,
      this.omitValues,
      this.pickValues,
      data,
    );

    return Array.from({ length: qty }, () => build());
  }

  buildMany<T extends this, Args extends BuildArg<T>[]>(
    this: T,
    ...arr: Args
  ): { [I in keyof Args]: BuildResult<T, Args[I]> } {
    const build = makeBuild(this, this.data, this.omitValues, this.pickValues);

    return arr.map(build) as { [I in keyof Args]: BuildResult<T, Args[I]> };
  }

  async create<T extends this, Data extends CreateArg<T>>(
    this: T,
    data?: Data,
  ): Promise<CreateResult<T>> {
    const getData = processCreateData(this, this.data, data);
    return (await (this.table as unknown as Query).create(
      await getData(),
    )) as never;
  }

  async createList<T extends this, Data extends CreateArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): Promise<CreateResult<T>[]> {
    const getData = processCreateData(this, this.data, data);
    const arr = await Promise.all([...Array(qty)].map(() => getData()));
    return (await (this.table as unknown as Query).createMany(
      arr as CreateData<T['table']>[],
    )) as never;
  }

  async createMany<T extends this, Args extends CreateArg<T>[]>(
    this: T,
    ...arr: Args
  ): Promise<{ [K in keyof Args]: CreateResult<T> }> {
    const getData = processCreateData(this, this.data);
    const data = await Promise.all(arr.map(getData));
    return (await (this.table as unknown as Query).createMany(
      data as CreateData<T['table']>[],
    )) as never;
  }

  extend<T extends this>(this: T): new () => TestFactory<Q, Type> {
    const { table, fns } = this;

    return class extends TestFactory<Q, Type> {
      constructor() {
        super(table, fns);
      }
    };
  }
}

type TableFactory<T extends CreateSelf> = TestFactory<
  T,
  ColumnShapeOutput<T['shape']>
>;

let fixedTime: Date | undefined;
let fixedTZ: string | undefined;

const int = (min: number, max: number) => faker.number.int({ min, max });

const float = (min: number, max: number, multipleOf: number) =>
  faker.number.float({
    min,
    max,
    multipleOf,
  });

const point = () => float(-100, 100, 0.01);

const isoTime = (c: ColumnTypeBase, sequence: number) => {
  const data = c.data as { min?: Date; max?: Date };

  return (
    data.min || data.max
      ? faker.date.between({
          from: data.min || new Date(-8640000000000000),
          to: data.max || new Date(8640000000000000),
        })
      : new Date((fixedTime ??= faker.date.anytime()).getTime() + sequence)
  ).toISOString();
};

const bool = () => faker.datatype.boolean();

const arr = (min: number, max: number, fn: (_: void, i: number) => unknown) =>
  Array.from({ length: int(min, max) }, fn);

const numOpts = (
  c: { data: BaseNumberData },
  step?: number | bigint,
  min?: number | bigint,
  max?: number | bigint,
  options?: RecordUnknown,
): RecordUnknown => ({
  min: c.data.gt ? c.data.gt + ((step as number) || 0) : c.data.gte || min,
  max: c.data.lt ? c.data.lt - ((step as number) || 0) : c.data.lte || max,
  ...options,
});

const num = (
  uniqueColumns: Set<string>,
  key: string,
  c: ColumnType<ColumnSchemaConfig>,
  method: 'int' | 'float' | 'bigInt' | 'amount',
  {
    step,
    min,
    max,
    module = 'number',
    ...options
  }: {
    step?: number | bigint;
    min?: number | bigint;
    max?: number | bigint;
    module?: 'number' | 'finance';
    fractionDigits?: number;
    symbol?: string;
  } = {},
): ((sequence: number) => unknown) => {
  const opts = numOpts(c, step, min, max, options);

  if (uniqueColumns.has(key)) {
    if (method === 'int' || method === 'float' || method === 'amount') {
      const st = (step as number | undefined) || 1;

      let min = ((opts.min as number | undefined) ?? 0) - st;
      if (min < 0) min = 0;

      const { symbol } = options;
      if (symbol) {
        return (sequence: number) => `${symbol}${min + sequence * st}`;
      } else {
        return (sequence: number) => min + sequence * st;
      }
    }

    if (method === 'bigInt') {
      const st = (step as bigint | undefined) || 1n;

      let min = ((opts.min as bigint | undefined) ?? 0n) - st;
      if (min < 0n) min = 0n;

      return (sequence: number) => min + BigInt(sequence) * st;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return () => (faker as any)[module][method](opts);
};

const makeGeneratorForColumn = (
  config: FactoryConfig,
  table: PickQueryShape,
  uniqueColumns: Set<string>,
  key: string,
  c: ColumnTypeBase,
): ((sequence: number) => unknown) | undefined => {
  let fn: (sequence: number) => unknown;

  const custom = config.fakeDataForTypes?.[c.dataType]?.(c);
  if (custom) {
    fn = custom;
  } else if (c instanceof EnumColumn) {
    fn = () => faker.helpers.arrayElement(c.options);
  } else if (c instanceof ArrayColumn) {
    fn = () =>
      arr(
        1,
        5,
        makeGeneratorForColumn(
          config,
          table,
          uniqueColumns,
          key,
          c.data.item,
        ) as () => unknown,
      );
  } else if (c instanceof SmallIntColumn || c instanceof SmallSerialColumn) {
    fn = num(uniqueColumns, key, c, 'int', {
      step: 1,
      min: -32768,
      max: 32767,
    });
  } else if (c instanceof IntegerColumn || c instanceof SerialColumn) {
    fn = num(uniqueColumns, key, c, 'int', {
      step: 1,
      min: -2147483648,
      max: 2147483648,
    });
  } else if (c instanceof BigIntColumn || c instanceof BigSerialColumn) {
    fn = num(uniqueColumns, key, c, 'bigInt', {
      step: 1n,
      min: BigInt('-9223372036854775808'),
      max: BigInt('9223372036854775807'),
    });
  } else if (c instanceof DecimalColumn || c instanceof DoublePrecisionColumn) {
    fn = num(uniqueColumns, key, c, 'float', {
      fractionDigits: c.data.numericScale,
    });
  } else if (c instanceof RealColumn) {
    fn = num(uniqueColumns, key, c, 'float');
  } else if (c instanceof MoneyColumn) {
    fn = num(uniqueColumns, key, c, 'amount', {
      module: 'finance',
      symbol: '$',
    });
  } else if (
    c instanceof VarCharColumn ||
    c instanceof TextColumn ||
    c instanceof StringColumn ||
    c instanceof CitextColumn
  ) {
    const data = c.data as StringTypeData;
    const lowerKey = key.toLowerCase();
    const strippedKey = lowerKey.replace(/_|-/g, '');

    let gen: ((sequence: number) => string) | undefined;
    const min = data.length ?? data.min ?? data.nonEmpty ? 1 : 0;
    const max = Math.min(
      data.length ?? data.max ?? Infinity,
      config.maxTextLength ?? 1000,
    );
    const { includes, startsWith, endsWith, trim, toLowerCase, toUpperCase } =
      data;

    let isEmail = false;
    let isUrl = false;

    if (data.email) {
      isEmail = true;
      gen = () => faker.internet.email();
    } else if (data.emoji) {
      gen = () => faker.internet.emoji();
    } else if (data.url) {
      isUrl = true;
      gen = () => faker.internet.url();
    } else if (data.uuid) {
      gen = () => faker.string.uuid();
    } else if (data.datetime) {
      gen = (sequence) => isoTime(c, sequence);
    } else if (data.ipv4) {
      gen = () => faker.internet.ipv4();
    } else if (data.ipv6) {
      gen = () => faker.internet.ipv6();
    } else if (data.regex) {
      const generator = new randexp(data.regex);

      generator.randInt = (min: number, max: number) =>
        faker.number.int({ min, max });

      if (max !== Infinity) {
        generator.max = max;
      }

      gen = () => generator.gen();
    } else if (strippedKey === 'name') {
      gen = () => faker.person.fullName();
    } else if (strippedKey === 'phonenumber') {
      gen = () => faker.phone.number();
    } else if (strippedKey === 'image' || strippedKey === 'imageurl') {
      gen = () => faker.image.url();
    } else {
      for (const sectionKey in faker) {
        for (const key in faker[sectionKey as keyof typeof faker]) {
          if (key === strippedKey) {
            // @eslint-disable-next-line typescript-eslint/no-exlicit-any
            const fn = (faker as any)[sectionKey][key];
            gen = () => String(fn());

            if (key === 'email') isEmail = true;
            else if (key === 'url') isUrl = true;
          }
        }
      }

      if (!gen) gen = () => faker.food.dish();
    }

    const isUnique = uniqueColumns.has(key);

    fn = (sequence) => {
      const seq = sequence++;

      let s = gen(seq);

      if (isUnique) {
        if (isEmail) s = `${seq}-${s}`;
        else if (isUrl) s = s.replace('://', `://${seq}-`);
        else s = `${seq} ${s}`;
      }

      while (s.length < min) {
        s += gen(seq);

        if (trim) s = s.trim();
      }

      if (s.length > max) {
        s = s.slice(0, max);

        if (trim) {
          s = s.trim();
          while (s.length < min) {
            s += gen(seq);
            if (trim) s = s.trim();
          }
        }
      }

      if (startsWith) {
        s = startsWith + s.slice(startsWith.length);
      }

      if (includes) {
        const start = Math.max(
          0,
          Math.floor(s.length / 2) - Math.floor(includes.length / 2),
        );
        s = s.slice(0, start) + includes + s.slice(start + includes.length);
      }

      if (endsWith) {
        s = s.slice(0, endsWith.length + 1) + endsWith;
      }

      return toLowerCase
        ? s.toLocaleLowerCase()
        : toUpperCase
        ? s.toLocaleUpperCase()
        : s;
    };
  } else if (c instanceof ByteaColumn) {
    fn = () => Buffer.from(arr(1, 10, () => int(0, 255)) as number[]);
  } else if (c instanceof DateColumn) {
    fn = (sequence) => isoTime(c, sequence).split('T')[0];
  } else if (c instanceof TimestampColumn || c instanceof TimestampTZColumn) {
    const hasTZ = c instanceof TimestampTZColumn;
    fn = (sequence) => {
      let timestamp = isoTime(c, sequence).replace('T', ' ');

      if (hasTZ) {
        if (!fixedTZ) {
          const minOffset = -720; // UTC-12:00
          const maxOffset = 840; // UTC+14:00
          const randomOffset = int(minOffset, maxOffset);

          const sign = randomOffset >= 0 ? '+' : '-';
          const absOffset = Math.abs(randomOffset);
          const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
          const minutes = String(absOffset % 60).padStart(2, '0');

          fixedTZ = `${sign}${hours}:${minutes}`;
        }

        timestamp += fixedTZ;
      }

      return timestamp;
    };
  } else if (c instanceof TimeColumn) {
    fn = (sequence) => isoTime(c, sequence).split('T')[1].replace(/\..+/, '');
  } else if (c instanceof IntervalColumn) {
    fn = () => {
      const years = int(0, 10);
      const months = int(0, 11);
      const days = int(0, 30);
      const hours = int(0, 23);
      const minutes = int(0, 59);
      const seconds = float(0, 59, 0.1);

      return `${years} years ${months} mons ${days} days ${hours} hours ${minutes} mins ${seconds.toFixed(
        1,
      )} secs`;
    };
  } else if (c instanceof BooleanColumn) {
    fn = bool;
  } else if (c instanceof PointColumn) {
    fn = () => `(${point()}, ${point()})`;
  } else if (c instanceof LineColumn) {
    fn = () => `{${point()},${point()},${point()}}`;
  } else if (c instanceof LsegColumn) {
    fn = () => `((${point()}, ${point()}), (${point()}, ${point()}))`;
  } else if (c instanceof BoxColumn) {
    fn = () => `((${point()}, ${point()}), (${point()}, ${point()}))`;
  } else if (c instanceof PathColumn) {
    fn = () => {
      const s = arr(2, 10, () => `(${point()}, ${point()})`).join(', ');
      return bool() ? `[${s}]` : `(${s})`;
    };
  } else if (c instanceof PolygonColumn) {
    fn = () => `(${arr(2, 10, () => `(${point()}, ${point()})`).join(', ')})`;
  } else if (c instanceof CircleColumn) {
    fn = () => `<(${point()}, ${point()}), ${float(0, 100, 0.01)}>`;
  } else if (c instanceof CidrColumn) {
    fn = () => `${faker.internet.ip()}/${int(0, 32)}`;
  } else if (c instanceof InetColumn) {
    fn = () => (bool() ? faker.internet.ip() : faker.internet.ipv6());
  } else if (c instanceof MacAddrColumn) {
    fn = () => faker.internet.mac();
  } else if (c instanceof MacAddr8Column) {
    fn = () =>
      Array.from({ length: 8 }, () =>
        faker.string.hexadecimal({ length: 2 }),
      ).join(':');
  } else if (c instanceof BitColumn) {
    const { length } = c.data;

    fn = () => Array.from({ length }, () => (bool() ? '1' : '0')).join('');
  } else if (c instanceof BitVaryingColumn) {
    const length = c.data.length;

    fn = () => arr(1, length || 100, () => (bool() ? '1' : '0')).join('');
  } else if (c instanceof TsVectorColumn) {
    fn = () => arr(1, 10, () => faker.lorem.word()).join(' ');
  } else if (c instanceof TsQueryColumn) {
    fn = () => {
      const operators = ['&', '|', '<->'];
      return arr(1, 10, (_, i) => {
        const word = faker.lorem.word();
        return i === 0
          ? word
          : faker.helpers.arrayElement(operators) + ' ' + word;
      }).join(' ');
    };
  } else if (c instanceof UUIDColumn) {
    fn = () => faker.string.uuid();
  } else if (c instanceof XMLColumn) {
    fn = () =>
      '<items>\n' +
      arr(
        1,
        5,
        () =>
          `  <item>
    <id>${faker.string.uuid()}</id>
    <name>${faker.person.firstName()}</name>
    <email>${faker.internet.email()}</email>
    <address>${faker.location.streetAddress()}</address>
    <created_at>${faker.date.past().toISOString()}</created_at>
  </item>
`,
      ).join('') +
      '</items>';
  } else if (c instanceof JSONColumn || c instanceof JSONTextColumn) {
    fn = () =>
      JSON.stringify(
        arr(1, 5, () => ({
          id: faker.string.uuid(),
          name: faker.person.firstName(),
          email: faker.internet.email(),
          address: {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            zip: faker.location.zipCode(),
          },
          createdAt: faker.date.past().toISOString(),
        })),
      );
  } else if (c instanceof VirtualColumn) {
    return;
  } else if (c instanceof PostgisGeographyPointColumn) {
    fn = () => {
      const lon = faker.location.longitude({ min: -180, max: 180 });
      const lat = faker.location.latitude({ min: -90, max: 90 });
      return PostgisGeographyPointColumn.encode({ lon, lat });
    };
  } else {
    const as = c.data.as;
    if (!as) {
      throw new Error(
        `Don't know how to generate data for column ${
          (table as unknown as Query).table
        }.${key} that has no \`as\``,
      );
    }

    return makeGeneratorForColumn(config, table, uniqueColumns, key, as);
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fn;
};

export const tableFactory = <T extends CreateSelf>(
  table: T,
  config?: TableFactoryConfig<T>,
): TableFactory<T> => {
  const { shape } = table;
  const fns: { [K: string]: (sequence: number) => unknown } = {
    ...config?.extend,
  } as never;

  const uniqueColumns = new Set<string>();
  for (const key in shape) {
    if (fns[key]) continue;

    const {
      data: { indexes, primaryKey },
    } = shape[key] as ColumnType;

    if (primaryKey) {
      uniqueColumns.add(key);
      continue;
    }

    if (!indexes) continue;

    for (const index of indexes) {
      if (index.options.unique) {
        uniqueColumns.add(key);
        break;
      }
    }
  }

  const { primaryKey, indexes } = (table as unknown as Query).internal
    .tableData;
  if (primaryKey) {
    for (const key of primaryKey.columns) {
      if (fns[key]) continue;

      uniqueColumns.add(key);
    }
  }

  if (indexes) {
    for (const index of indexes) {
      if (index.options.unique) {
        for (const item of index.columns) {
          if ('column' in item) {
            uniqueColumns.add(item.column);
          }
        }
      }
    }
  }

  for (const key in shape) {
    if (fns[key]) continue;

    const fn = makeGeneratorForColumn(
      config || emptyObject,
      table,
      uniqueColumns,
      key,
      (shape as unknown as ColumnsShape)[key],
    );
    if (fn) fns[key] = fn;
  }

  return new TestFactory(table, fns, config) as TableFactory<T>;
};

type ORMFactory<T> = {
  [K in keyof T]: T[K] extends CreateSelf ? TableFactory<T[K]> : never;
};

export const ormFactory = <T>(
  orm: T,
  options?: OrmFactoryConfig<T>,
): ORMFactory<T> => {
  const factory = {} as ORMFactory<T>;
  const defined: RecordUnknown = {};

  for (const key in orm) {
    const table = orm[key];
    if (table && typeof table === 'object' && 'definedAs' in table) {
      Object.defineProperty(factory, key, {
        get() {
          return (defined[key] ??= tableFactory(
            table as unknown as CreateSelf,
            {
              ...options,
              extend: options?.extend?.[key],
            },
          ));
        },
      });
    }
  }

  return factory;
};
