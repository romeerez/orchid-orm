import { AnyZodObject } from 'zod';
import { EmptyObject, Query } from 'pqb';
import { instanceToZod, InstanceToZod } from 'porm-schema-to-zod';
import { generateMock } from '@anatine/zod-mock';

type metaKey = typeof metaKey;
const metaKey = Symbol('meta');

type Result<
  T extends TestFactory,
  BaseData,
  Data extends BaseData,
  Omitted = Omit<
    BaseData extends Data
      ? T[metaKey]['type']
      : T[metaKey]['type'] & {
          [K in keyof Data]: Data[K] extends () => void
            ? ReturnType<Data[K]>
            : Data[K];
        },
    keyof T[metaKey]['omit']
  >,
> = EmptyObject extends T[metaKey]['pick']
  ? Omitted
  : Pick<
      Omitted,
      {
        [K in keyof Omitted]: K extends keyof T[metaKey]['pick'] ? K : never;
      }[keyof Omitted]
    >;

type BuildArg<T extends TestFactory> = CreateArg<T> & Record<string, unknown>;

type BuildResult<T extends TestFactory, Data extends BuildArg<T>> = Result<
  T,
  BuildArg<T>,
  Data
>;

type CreateArg<T extends TestFactory> = {
  [K in keyof T[metaKey]['type']]?:
    | T[metaKey]['type'][K]
    | (() => T[metaKey]['type'][K]);
};

type CreateResult<T extends TestFactory, Data extends CreateArg<T>> = Result<
  T,
  CreateArg<T>,
  Data
>;

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

export class TestFactory<
  Schema extends AnyZodObject = AnyZodObject,
  Type extends EmptyObject = EmptyObject,
> {
  private readonly data: EmptyObject;
  private readonly omitValues: Record<PropertyKey, true> = {};
  private readonly pickValues: Record<PropertyKey, true> = {};

  [metaKey]!: {
    type: Type;
    omit: EmptyObject;
    pick: EmptyObject;
  };

  constructor(public model: Query, public schema: Schema) {
    this.data = {};
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
        result[key] = value();
      } else {
        result[key] = value;
      }
    }
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
  ): Promise<CreateResult<T, Data>> {
    const obj = this.build(data);
    return (await this.model.create(obj)) as CreateResult<T, Data>;
  }

  async createList<T extends this, Data extends CreateArg<T>>(
    this: T,
    qty: number,
    data?: Data,
  ): Promise<CreateResult<T, Data>[]> {
    const arr = [...Array(qty)].map(() => this.build(data));
    return (await this.model.createMany(arr)) as CreateResult<T, Data>[];
  }

  extend<T extends this>(this: T): new () => TestFactory<Schema, Type> {
    const { model, schema } = this;

    return class extends TestFactory<Schema, Type> {
      constructor() {
        super(model, schema);
      }
    };
  }
}

export const createFactory = <T extends Query>(model: T) => {
  return new TestFactory<InstanceToZod<T>, T['type']>(
    model,
    instanceToZod(model),
  );
};
