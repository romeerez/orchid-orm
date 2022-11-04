import { ColumnsShape, EmptyObject, StringKey } from 'pqb';
import { InstanceToZod, instanceToZod } from 'porm-schema-to-zod';
import { generateMock } from '@anatine/zod-mock';
import { AnyZodObject, ZodObject, ZodRawShape } from 'zod';

// Converts union to overloaded function
type OptionalPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? K : never;
}[keyof T];

type SpreadProperties<L, R, K extends keyof L & keyof R> = {
  [P in K]: L[P] | Exclude<R[P], undefined>;
};

type Id<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

type SpreadTwo<L, R> = Id<
  Pick<L, Exclude<keyof L, keyof R>> &
    Pick<R, Exclude<keyof R, OptionalPropertyNames<R>>> &
    Pick<R, Exclude<OptionalPropertyNames<R>, keyof L>> &
    SpreadProperties<L, R, OptionalPropertyNames<R> & keyof L>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spread<A extends readonly [...any]> = A extends [
  infer L,
  ...infer R,
]
  ? SpreadTwo<L, Spread<R>>
  : unknown;

type FactoryBase = { shape: ColumnsShape; type: EmptyObject };

type KeysMask<T extends TestFactory> = {
  [K in keyof T['schema']['shape']]?: true;
};

type BuildArg<T extends TestFactory> = {
  [K in keyof T['result']]?: T['result'][K] | (() => T['result'][K]);
} & Record<string, unknown>;

type CreateArg<T extends TestFactory> = {
  [K in keyof T['result']]?: T['result'][K] | (() => T['result'][K]);
};

type ResolveOverrides<Arg> = {
  [K in keyof Arg]: Arg[K] extends () => unknown ? ReturnType<Arg[K]> : Arg[K];
};

type TestFactoryBuild<T extends TestFactory, Arg> = BuildArg<T> extends Arg
  ? T['result']
  : Omit<T['result'], keyof Arg> & ResolveOverrides<Arg>;

type TestFactoryCreate<T extends TestFactory, Arg> = T['result'] & Arg;

type TestFactoryOmit<T extends TestFactory, Keys extends KeysMask<T>> = Omit<
  T,
  'schema' | 'data' | 'result'
> & {
  schema: ZodObject<Omit<T['schema']['shape'], keyof Keys>>;
  data: Omit<T['data'], keyof Keys>;
  result: Omit<T['result'], keyof Keys>;
};

type TestFactoryPick<T extends TestFactory, Keys extends KeysMask<T>> = Omit<
  T,
  'schema' | 'data' | 'result'
> & {
  schema: ZodObject<Pick<T['schema']['shape'], StringKey<keyof Keys>>>;
  data: Pick<
    T['data'],
    {
      [K in keyof T['data']]: K extends keyof Keys ? K : never;
    }[keyof T['data']]
  >;
  result: Pick<
    T['result'],
    {
      [K in keyof T['result']]: K extends keyof Keys ? K : never;
    }[keyof T['result']]
  >;
};

type TestFactorySet<T extends TestFactory, Arg extends CreateArg<T>> = Omit<
  T,
  'data'
> & {
  data: Spread<[T['data'], Arg]>;
};

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
  Schema extends ZodObject<ZodRawShape> = AnyZodObject,
  Result extends EmptyObject = EmptyObject,
  Data extends EmptyObject = EmptyObject,
> {
  schema: Schema;
  result!: Result;

  constructor(public model: FactoryBase, public data: Data = {} as Data) {
    this.schema = instanceToZod(model) as unknown as Schema;
  }

  build<T extends TestFactory, Arg extends BuildArg<T>>(
    this: T,
    arg?: Arg,
  ): TestFactoryBuild<T, Spread<[Data, Arg]>> {
    const result = generateMock(this.schema) as Record<string, unknown>;
    const data = arg ? { ...this.data, ...arg } : this.data;
    for (const key in data) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === 'function') {
        result[key] = value();
      } else {
        result[key] = value;
      }
    }
    return result as TestFactoryBuild<T, Spread<[Data, Arg]>>;
  }

  buildList<T extends TestFactory, Arg extends BuildArg<T>>(
    this: T,
    qty: number,
    arg?: Arg,
  ): TestFactoryBuild<T, Spread<[Data, Arg]>>[] {
    return [...Array(qty)].map(() =>
      this.build(arg),
    ) as unknown as TestFactoryBuild<T, Spread<[Data, Arg]>>[];
  }

  async create<T extends TestFactory, Arg extends CreateArg<T>>(
    this: T,
    data?: Arg,
  ): Promise<TestFactoryCreate<T, Arg>> {
    const obj = this.build(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await (this.model as any).create(obj as any)) as TestFactoryCreate<
      T,
      Arg
    >;
  }

  async createList<T extends TestFactory, Arg extends CreateArg<T>>(
    this: T,
    qty: number,
    data?: Arg,
  ): Promise<TestFactoryCreate<T, Arg>[]> {
    const obj = [...Array(qty)].map(() => this.build(data));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await (this.model as any).createMany(
      obj as any,
    )) as TestFactoryCreate<T, Arg>[];
  }

  omit<T extends TestFactory, Keys extends KeysMask<T>>(
    this: T,
    keys: Keys,
  ): TestFactoryOmit<T, Keys> {
    return Object.assign(Object.create(this), {
      schema: this.schema.omit(keys),
      data: omit(this.data, keys),
    });
  }

  pick<T extends TestFactory, Keys extends KeysMask<T>>(
    this: T,
    keys: Keys,
  ): TestFactoryPick<T, Keys> {
    return Object.assign(Object.create(this), {
      schema: this.schema.pick(keys),
      data: pick(this.data, keys),
    });
  }

  set<T extends TestFactory, Arg extends CreateArg<T>>(
    this: T,
    data: Arg,
  ): TestFactorySet<T, Arg> {
    return Object.assign(Object.create(this), {
      data: {
        ...this.data,
        ...data,
      },
    });
  }

  // extend<
  //   T extends TestFactory<F>,
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   Methods extends Record<string, (this: T, ...args: any[]) => any>,
  // >(this: T, methods: Methods): T & Methods {
  //   return Object.assign(Object.create(this), methods);
  // }
}

export const createFactory = <T extends FactoryBase>(
  model: T,
): TestFactory<InstanceToZod<T>, T['type']> => {
  return new TestFactory(model) as TestFactory<InstanceToZod<T>, T['type']>;
};
