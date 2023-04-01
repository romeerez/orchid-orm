import { AnyZodObject, ZodNullable, ZodString, ZodTypeAny } from 'zod';
import {
  CreateData,
  DateBaseColumn,
  IntegerBaseColumn,
  NumberBaseColumn,
  Query,
  TextBaseColumn,
} from 'pqb';
import { EmptyObject } from 'orchid-core';
import { instanceToZod, InstanceToZod } from 'orchid-orm-schema-to-zod';
import { generateMock } from '@anatine/zod-mock';

type UniqueField =
  | {
      key: string;
      type: 'text';
      kind?: 'email' | 'url';
      max?: number;
      length?: number;
    }
  | {
      key: string;
      type: 'number';
      gt?: number;
      gte?: number;
    };

type FactoryOptions = {
  sequence?: number;
  sequenceDistance?: number;
  maxTextLength?: number;
};

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
} & Record<string, unknown>;

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

type CreateArg<T extends TestFactory> = CreateData<
  Omit<T['table'], 'inputType'> & {
    inputType: {
      [K in keyof T['table']['type']]?:
        | T['table']['type'][K]
        | ((sequence: number) => T['table']['type'][K]);
    };
  }
>;

type CreateResult<T extends TestFactory> = Result<T, T['table']['type']>;

const omit = <T, Keys extends Record<string, unknown>>(
  obj: T,
  keys: Keys,
): Omit<T, keyof Keys> => {
  const res = { ...obj };
  Object.keys(keys).forEach((key) => {
    delete (res as unknown as Record<string, unknown>)[key];
  });
  return res;
};

const pick = <T, Keys extends Record<string, unknown>>(
  obj: T,
  keys: Keys,
): Pick<T, { [K in keyof T]: K extends keyof Keys ? K : never }[keyof T]> => {
  const res = {} as T;
  Object.keys(keys).forEach((key) => {
    const value = (obj as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      (res as unknown as Record<string, unknown>)[key] = value;
    }
  });
  return res;
};

const makeUniqueText = (sequence: number, value: string) =>
  `${sequence} ${value}`;

const makeUniqueEmail = (sequence: number, value: string) =>
  `${sequence}-${value}`;

const makeUniqueUrl = (sequence: number, value: string) =>
  value.replace('://', `://${sequence}-`);

const makeUniqueNumber = (sequence: number) => sequence;

const makeSetUniqueValues = (
  uniqueFields: UniqueField[],
  data: Record<string, unknown>,
) => {
  type Fn = (sequence: number, value: unknown) => unknown;

  const dataKeys = Object.keys(data);

  const fns: Record<string, Fn> = {};
  for (const field of uniqueFields) {
    if (dataKeys.includes(field.key)) continue;

    if (field.type === 'text') {
      const getValue =
        field.kind === 'email'
          ? makeUniqueEmail
          : field.kind === 'url'
          ? makeUniqueUrl
          : makeUniqueText;

      let fn;
      const max = field.length ?? field.max;
      if (max !== undefined) {
        fn = (sequence: number, value: string) => {
          let result = getValue(sequence, value);
          if (result.length > max) {
            result = result.slice(0, -(result.length - max));
          }
          return result;
        };
      } else {
        fn = getValue;
      }
      fns[field.key] = fn as unknown as Fn;
    } else {
      let fn;
      const { gt, gte } = field;
      if (gt) {
        fn = (sequence: number) => sequence + gt;
      } else if (gte) {
        fn = (sequence: number) => sequence + gte - 1;
      } else {
        fn = makeUniqueNumber;
      }
      fns[field.key] = fn as unknown as Fn;
    }
  }

  return (record: Record<string, unknown>, sequence: number) => {
    for (const key in fns) {
      record[key] = fns[key](sequence, record[key]);
    }
  };
};

const makeBuild = <T extends TestFactory, Data extends BuildArg<T>>(
  factory: T,
  data: Record<string, unknown>,
  omitValues: Record<PropertyKey, true>,
  pickValues: Record<PropertyKey, true>,
  uniqueFields: UniqueField[],
  arg?: Data,
) => {
  let schema = factory.schema as AnyZodObject;
  let allData = arg ? { ...data, ...arg } : data;

  if (omitValues) {
    schema = schema.omit(omitValues);
    allData = omit(allData, omitValues);
  }

  if (pickValues && Object.keys(pickValues).length) {
    schema = schema.pick(pickValues);
    allData = pick(allData, pickValues);
  }

  const setUniqueValues = makeSetUniqueValues(uniqueFields, allData);

  return () => {
    const result = generateMock(schema) as Record<string, unknown>;
    for (const key in allData) {
      const value = (allData as Record<string, unknown>)[key];
      if (typeof value === 'function') {
        result[key] = value(factory.sequence);
      } else {
        result[key] = value;
      }
    }

    setUniqueValues(result, factory.sequence);

    factory.sequence++;

    return result as BuildResult<T, Data>;
  };
};

const processCreateData = <T extends TestFactory, Data extends CreateArg<T>>(
  factory: T,
  data: Record<string, unknown>,
  uniqueFields: UniqueField[],
  arg?: Data,
) => {
  const pick: Record<string, true> = {};
  for (const key in factory.table.shape) {
    pick[key] = true;
  }

  factory.table.primaryKeys.forEach((key) => {
    const item = factory.table.shape[key];

    if (item.data.identity || item.dataType.includes('serial')) {
      delete pick[key];
    }
  });

  const result: Record<string, unknown> = {};

  const fns: Record<string, (sequence: number) => unknown> = {};

  const allData = (arg ? { ...data, ...arg } : data) as Record<string, unknown>;

  for (const key in allData) {
    delete pick[key];
    const value = allData[key];
    if (typeof value === 'function') {
      fns[key] = value as () => unknown;
    } else {
      result[key] = value;
    }
  }

  const pickedSchema = factory.schema.pick(pick);
  const setUniqueValues = makeSetUniqueValues(uniqueFields, allData);

  return () => {
    Object.assign(result, generateMock(pickedSchema));

    for (const key in fns) {
      result[key] = fns[key](factory.sequence);
    }

    setUniqueValues(result, factory.sequence);

    factory.sequence++;

    return { ...result } as CreateData<T['table']>;
  };
};

export class TestFactory<
  Q extends Query = Query,
  Schema extends AnyZodObject = AnyZodObject,
  Type extends EmptyObject = EmptyObject,
> {
  sequence: number;
  private readonly omitValues: Record<PropertyKey, true> = {};
  private readonly pickValues: Record<PropertyKey, true> = {};

  [metaKey]!: {
    type: Type;
    omit: EmptyObject;
    pick: EmptyObject;
  };

  constructor(
    public table: Q,
    public schema: Schema,
    private uniqueFields: UniqueField[],
    private readonly data: Record<string, unknown> = {},
    options: FactoryOptions = {},
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
    } & Record<string, unknown>,
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
    const build = makeBuild(
      this,
      this.data,
      this.omitValues,
      this.pickValues,
      this.uniqueFields,
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
      this.uniqueFields,
      data,
    );

    return [...Array(qty)].map(build);
  }

  async create<T extends this, Data extends CreateArg<T>>(
    this: T,
    data?: Data,
  ): Promise<CreateResult<T>> {
    const getData = processCreateData(this, this.data, this.uniqueFields, data);
    return (await this.table.create(getData())) as CreateResult<T>;
  }

  async createList<T extends this, Data extends CreateArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): Promise<CreateResult<T>[]> {
    const getData = processCreateData(this, this.data, this.uniqueFields, data);
    const arr = [...Array(qty)].map(getData);
    return (await this.table.createMany(arr)) as CreateResult<T>[];
  }

  extend<T extends this>(this: T): new () => TestFactory<Q, Schema, Type> {
    const { table, schema, uniqueFields } = this;

    return class extends TestFactory<Q, Schema, Type> {
      constructor() {
        super(table, schema, uniqueFields);
      }
    };
  }
}

const nowString = new Date().toISOString();

export const createFactory = <T extends Query>(
  table: T,
  options?: FactoryOptions,
) => {
  const schema = instanceToZod(table);

  const data: Record<string, unknown> = {};
  const now = Date.now();

  const uniqueFields: UniqueField[] = [];

  for (const key in table.shape) {
    const column = table.shape[key];
    if (column instanceof DateBaseColumn) {
      if (column.data.as instanceof IntegerBaseColumn) {
        data[key] = (sequence: number) => now + sequence;
      } else if (column.parseFn?.(nowString) instanceof Date) {
        data[key] = (sequence: number) => new Date(now + sequence);
      } else {
        data[key] = (sequence: number) =>
          new Date(now + sequence).toISOString();
      }
    } else if (column instanceof TextBaseColumn) {
      const max = options?.maxTextLength ?? 1000;
      const item = schema.shape[key];
      const string = (
        item instanceof ZodNullable ? item.unwrap() : item
      ) as ZodString;

      const maxCheck = string._def.checks.find(
        (check) => check.kind === 'max',
      ) as { value: number } | undefined;

      if (!maxCheck || maxCheck.value > max) {
        (schema.shape as Record<string, ZodTypeAny>)[key] =
          item instanceof ZodNullable
            ? string.max(max).nullable()
            : string.max(max);
      }
    }

    if (column.data.indexes?.some((index) => index.unique)) {
      if (column instanceof TextBaseColumn) {
        uniqueFields.push({
          key,
          type: 'text',
          kind: column.data.email
            ? 'email'
            : column.data.url
            ? 'url'
            : undefined,
          max: column.data.max,
          length: column.data.length,
        });
      } else if (column instanceof NumberBaseColumn) {
        uniqueFields.push({
          key,
          type: 'number',
          gt: column.data.gt,
          gte: column.data.gte,
        });
      }
    }
  }

  return new TestFactory<T, InstanceToZod<T>, T['type']>(
    table,
    schema,
    uniqueFields,
    data,
    options,
  );
};
