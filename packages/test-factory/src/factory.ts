import { AnyZodObject, ZodNullable, ZodString, ZodTypeAny } from 'zod';
import {
  CreateData,
  DateBaseColumn,
  EmptyObject,
  IntegerBaseColumn,
  Query,
  TextBaseColumn,
} from 'pqb';
import { instanceToZod, InstanceToZod } from 'porm-schema-to-zod';
import { generateMock } from '@anatine/zod-mock';

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
  Omit<T['model'], 'inputType'> & {
    inputType: {
      [K in keyof T['model']['type']]?:
        | T['model']['type'][K]
        | ((sequence: number) => T['model']['type'][K]);
    };
  }
>;

type CreateResult<T extends TestFactory> = Result<T, T['model']['type']>;

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

const processCreateData = <T extends TestFactory, Data extends CreateArg<T>>(
  factory: T,
  data: Record<string, unknown>,
  arg?: Data,
) => {
  const pick: Record<string, true> = {};
  for (const key in factory.model.shape) {
    pick[key] = true;
  }

  factory.model.primaryKeys.forEach((key) => {
    if (factory.model.shape[key].dataType.includes('serial')) {
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

  return () => {
    Object.assign(result, generateMock(pickedSchema));

    for (const key in fns) {
      result[key] = fns[key](factory.sequence);
    }

    factory.sequence++;

    return { ...result } as CreateData<T['model']>;
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
    public model: Q,
    public schema: Schema,
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
    let schema = this.schema as AnyZodObject;
    let arg = data ? { ...this.data, ...data } : this.data;

    if (this.omitValues) {
      schema = schema.omit(this.omitValues);
      arg = omit(arg, this.omitValues);
    }

    if (this.pickValues && Object.keys(this.pickValues).length) {
      schema = schema.pick(this.pickValues);
      arg = pick(arg, this.pickValues);
    }

    const result = generateMock(schema) as Record<string, unknown>;
    for (const key in arg) {
      const value = (arg as Record<string, unknown>)[key];
      if (typeof value === 'function') {
        result[key] = value(this.sequence);
      } else {
        result[key] = value;
      }
    }

    this.sequence++;

    return result as BuildResult<T, Data>;
  }

  buildList<T extends this, Data extends BuildArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): BuildResult<T, Data>[] {
    return [...Array(qty)].map(() => this.build(data));
  }

  async create<T extends this, Data extends CreateArg<T>>(
    this: T,
    data?: Data,
  ): Promise<CreateResult<T>> {
    const getData = processCreateData(this, this.data, data);
    return (await this.model.create(getData())) as CreateResult<T>;
  }

  async createList<T extends this, Data extends CreateArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): Promise<CreateResult<T>[]> {
    const getData = processCreateData(this, this.data, data);
    const arr = [...Array(qty)].map(getData);
    return (await this.model.createMany(arr)) as CreateResult<T>[];
  }

  extend<T extends this>(this: T): new () => TestFactory<Q, Schema, Type> {
    const { model, schema } = this;

    return class extends TestFactory<Q, Schema, Type> {
      constructor() {
        super(model, schema);
      }
    };
  }
}

const nowString = new Date().toISOString();

export const createFactory = <T extends Query>(
  model: T,
  options?: FactoryOptions,
) => {
  const schema = instanceToZod(model);

  const data: Record<string, unknown> = {};
  const now = Date.now();

  for (const key in model.shape) {
    const column = model.shape[key];
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
      (schema.shape as Record<string, ZodTypeAny>)[key] =
        item instanceof ZodNullable
          ? (item.unwrap() as ZodString).max(max).nullable()
          : (schema.shape[key] as ZodString).max(max);
    }
  }

  return new TestFactory<T, InstanceToZod<T>, T['type']>(
    model,
    schema,
    data,
    options,
  );
};
