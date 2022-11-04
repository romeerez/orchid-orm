import {
  ArrayColumn,
  ColumnsShape,
  ColumnType,
  DateColumn,
  EnumColumn,
  JSONColumn,
  NumberColumn,
  TextColumn,
  JSONTypeAny,
  Primitive,
  JSONArray,
  JSONEnum,
  JSONInstanceOf,
  JSONLiteral,
  JSONMap,
  EnumLike,
  JSONNativeEnum,
  JSONDate,
  JSONNumber,
  JSONString,
  JSONSet,
  JSONTuple,
  JSONObject,
  UnknownKeysParam,
  JSONDiscriminatedObject,
  JSONDiscriminatedUnion,
  JSONRecord,
  JSONRecordKeyType,
  JSONIntersection,
  JSONUnion,
  JSONLazy,
} from 'pqb';
import { z, ZodTypeAny } from 'zod';
import { Buffer } from 'node:buffer';

type NumberType =
  | 'smallint'
  | 'integer'
  | 'real'
  | 'smallserial'
  | 'serial'
  | 'money';

type BigIntType =
  | 'bigint'
  | 'numeric'
  | 'decimal'
  | 'double precision'
  | 'bigserial';

type StringType = 'varchar' | 'char' | 'text' | 'string' | 'xml' | 'json';

type DateTimeType = 'date' | 'timestamp' | 'timestamp with time zone';

type TimeType = 'time' | 'time with time zone';

type GeometryType =
  | 'point'
  | 'line'
  | 'lseg'
  | 'box'
  | 'path'
  | 'polygon'
  | 'circle';

type NetworkType = 'cidr' | 'inet' | 'macaddr' | 'macaddr8';

type BitStringType = 'bit' | 'bit varying';

type FullTextSearchType = 'tsvector' | 'tsquery';

type UUIDType = 'uuid';

type ByteaType = 'bytea';

type SchemaToZod<
  T extends ColumnType,
  D = T['dataType'],
> = T['isNullable'] extends true
  ? z.ZodNullable<SchemaToZod<Omit<T, 'isNullable'> & { isNullable: false }>>
  : D extends NumberType
  ? z.ZodNumber
  : D extends
      | BigIntType
      | StringType
      | TimeType
      | GeometryType
      | NetworkType
      | BitStringType
      | FullTextSearchType
      | UUIDType
  ? z.ZodString
  : D extends ByteaType
  ? z.ZodType<Buffer>
  : D extends DateTimeType
  ? z.ZodDate
  : D extends 'interval'
  ? typeof interval
  : D extends 'boolean'
  ? z.ZodBoolean
  : T extends EnumColumn<string, infer U>
  ? z.ZodEnum<U>
  : T extends ArrayColumn<infer U>
  ? z.ZodArray<SchemaToZod<U>>
  : T extends JSONColumn
  ? JsonToZod<T['data']['schema']>
  : never;

type JsonToZod<T extends JSONTypeAny, D = T['dataType']> = T extends {
  types: [JSONTypeAny, JSONTypeAny, ...JSONTypeAny[]];
}
  ? z.ZodUnion<MapJsonTuple<T['types']>>
  : T['data'] extends {
      nullable: true;
    }
  ? T['data'] extends { optional: true }
    ? z.ZodNullable<
        z.ZodOptional<
          JsonToZod<
            Omit<T, 'data'> & { data: Omit<T['data'], 'nullable' | 'optional'> }
          >
        >
      >
    : z.ZodNullable<
        JsonToZod<Omit<T, 'data'> & { data: Omit<T['data'], 'nullable'> }>
      >
  : T['data'] extends { optional: true }
  ? z.ZodOptional<
      JsonToZod<Omit<T, 'data'> & { data: Omit<T['data'], 'optional'> }>
    >
  : D extends 'bigint'
  ? z.ZodString
  : D extends 'boolean'
  ? z.ZodBoolean
  : D extends 'date'
  ? z.ZodDate
  : D extends 'nan'
  ? z.ZodNaN
  : D extends 'never'
  ? z.ZodNever
  : D extends 'null'
  ? z.ZodNull
  : D extends 'number'
  ? z.ZodNumber
  : D extends 'string'
  ? z.ZodString
  : D extends 'undefined'
  ? z.ZodUndefined
  : D extends 'unknown'
  ? z.ZodUnknown
  : D extends 'void'
  ? z.ZodVoid
  : T extends JSONArray<infer U>
  ? z.ZodArray<JsonToZod<U>>
  : T extends JSONEnum<string, infer U>
  ? z.ZodEnum<U>
  : T extends JSONInstanceOf<infer U>
  ? z.ZodType<InstanceType<U>, z.ZodTypeDef, InstanceType<U>>
  : T extends JSONLiteral<infer U>
  ? z.ZodLiteral<U>
  : T extends JSONMap<infer K, infer V>
  ? z.ZodMap<JsonToZod<K>, JsonToZod<V>>
  : T extends JSONSet<infer U>
  ? z.ZodSet<JsonToZod<U>>
  : T extends JSONNativeEnum<infer U>
  ? z.ZodNativeEnum<U>
  : T extends JSONTuple<infer U, infer R>
  ? z.ZodTuple<MapJsonTuple<U>, R extends JSONTypeAny ? JsonToZod<R> : null>
  : T extends JSONObject<Record<string, JSONTypeAny>, UnknownKeysParam>
  ? z.ZodObject<
      { [K in keyof T['shape']]: JsonToZod<T['shape'][K]> },
      T['unknownKeys'],
      JsonToZod<T['catchAllType']>
    >
  : T extends JSONRecord<JSONRecordKeyType, JSONTypeAny>
  ? z.ZodRecord<
      JsonToZod<T['keyType']> extends z.ZodType<
        string | number | symbol,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any
      >
        ? JsonToZod<T['keyType']>
        : never,
      JsonToZod<T['valueType']>
    >
  : T extends JSONIntersection<JSONTypeAny, JSONTypeAny>
  ? z.ZodIntersection<JsonToZod<T['left']>, JsonToZod<T['right']>>
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends JSONDiscriminatedUnion<string, Primitive, any>
  ? z.ZodDiscriminatedUnion<
      T['discriminator'],
      T['discriminatorValue'],
      JsonToZod<T['_option']> extends z.ZodDiscriminatedUnionOption<
        T['discriminator'],
        T['discriminatorValue']
      >
        ? JsonToZod<T['_option']>
        : never
    >
  : D extends 'any'
  ? z.ZodTypeAny
  : z.ZodType<T['type']>;

type MapJsonTuple<T extends unknown[]> = T extends [infer Head, ...infer Tail]
  ? [Head extends JSONTypeAny ? JsonToZod<Head> : never, ...MapJsonTuple<Tail>]
  : [];

export type ModelToZod<
  T extends new () => { columns: { shape: ColumnsShape } },
> = InstanceToZod<InstanceType<T>['columns']>;

export const modelToZod = <
  T extends new () => { columns: { shape: ColumnsShape } },
>(
  model: T,
): ModelToZod<T> => {
  return instanceToZod(new model().columns) as unknown as ModelToZod<T>;
};

export type InstanceToZod<T extends { shape: ColumnsShape }> = z.ZodObject<{
  [K in keyof T['shape']]: SchemaToZod<T['shape'][K]>;
}>;

export const instanceToZod = <T extends { shape: ColumnsShape }>({
  shape,
}: T): InstanceToZod<T> => {
  const result = {} as z.ZodRawShape;
  for (const key in shape) {
    result[key as keyof typeof result] = columnToZod(shape[key]);
  }
  return z.object(result) as InstanceToZod<T>;
};

export const columnToZod = <T extends ColumnType>(
  column: T,
): SchemaToZod<T> => {
  const converter = converters[column.dataType];
  if (!converter) throw new Error(`Cannot parse column ${column.dataType}`);
  return converter(column) as SchemaToZod<T>;
};

const typeHandler = <Type extends ColumnType | JSONTypeAny>(
  fn: (column: Type) => z.ZodTypeAny,
) => {
  return (column: ColumnType | JSONTypeAny) => {
    let type = fn(column as Type);

    column.chain.forEach((item) => {
      if (item[0] === 'transform') {
        type = type.transform(item[1]);
      } else if (item[0] === 'to') {
        type = z.preprocess(item[1], itemToZod(item[2]));
      } else if (item[0] === 'refine') {
        type = type.refine(item[1]);
      } else if (item[0] === 'superRefine') {
        type = type.superRefine(item[1]);
      }
    });

    if (
      ('nullable' in column.data && column.data.nullable) ||
      (column as ColumnType).isNullable
    ) {
      if ('optional' in column.data && column.data.optional) {
        type = type.nullish();
      } else {
        type = type.nullable();
      }
    } else if ('optional' in column.data && column.data.optional) {
      type = type.optional();
    }

    if (column instanceof ColumnType) {
      if (column.data.validationDefault !== undefined) {
        type = type.default(column.data.validationDefault);
      }
    } else if (column.data.default !== undefined) {
      type = type.default(column.data.default);
    }

    return type;
  };
};

const stringParams = [
  'min',
  'max',
  'length',
  'regex',
  'startsWith',
  'endsWith',
];
const stringEmptyParams = ['email', 'url', 'uuid', 'cuid', 'trim'];
const handleString = typeHandler((column: TextColumn | JSONString) => {
  let type = z.string();
  stringParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = (
        type as unknown as Record<string, (value: unknown) => z.ZodString>
      )[key](value);
    }
  });
  stringEmptyParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value) {
      type = (type as unknown as Record<string, () => z.ZodString>)[key]();
    }
  });
  return type;
});

const numberParams = ['lt', 'lte', 'gt', 'gte', 'multipleOf'];
const handleNumber = typeHandler((column: NumberColumn | JSONNumber) => {
  let type = z.number();
  numberParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = (
        type as unknown as Record<string, (value: unknown) => z.ZodNumber>
      )[key](value);
    }
  });
  if ((column.data as Record<string, boolean>).int) {
    type = type.int();
  }
  return type;
});

const handleBigInt = typeHandler(() => {
  return z.string().refine(
    (value) => {
      try {
        BigInt(value);
        return true;
      } catch (_) {
        return false;
      }
    },
    {
      message: 'Failed to parse bigint',
    },
  );
});

const handleBuffer = typeHandler(() => {
  return z.instanceof(Buffer);
});

const dateParams = ['min', 'max'];
const handleDate = typeHandler((column: DateColumn | JSONDate) => {
  let type = z.date();
  dateParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = (type as unknown as Record<string, (value: unknown) => z.ZodDate>)[
        key
      ](value);
    }
  });

  return z.preprocess(
    (val) => (typeof val === 'string' ? new Date(val) : val),
    type,
  );
});

const handleTime = typeHandler(() => {
  return z.string().refine(
    (val) => {
      return !isNaN(new Date(`2000-01-01 ${val}`).getTime());
    },
    {
      message: 'Invalid time',
    },
  );
});

const interval = z
  .object({
    years: z.number().optional(),
    months: z.number().optional(),
    days: z.number().optional(),
    hours: z.number().optional(),
    seconds: z.number().optional(),
  })
  .strict();

const handleInterval = typeHandler(() => {
  return interval;
});

const handleBoolean = typeHandler(() => {
  return z.boolean();
});

const handleEnum = typeHandler((column: EnumColumn | JSONEnum) => {
  const enumColumn = column as
    | EnumColumn<string, [string, ...string[]]>
    | JSONEnum<string, [string, ...string[]]>;
  return z.enum(enumColumn.options);
});

const handleBitString = typeHandler(() => {
  return z.string().regex(/[10]/g);
});

const handleUUID = typeHandler(() => {
  return z.string().uuid();
});

const arrayParams = ['min', 'max', 'length'];
const handleArray = typeHandler(
  (array: ArrayColumn<ColumnType> | JSONArray<JSONTypeAny>) => {
    let type: z.ZodArray<z.ZodTypeAny>;
    if ('element' in array) {
      type = z.array(jsonItemToZod(array.element));
    } else {
      type = z.array(columnToZod(array.data.item));
    }

    arrayParams.forEach((key) => {
      const value = (array.data as Record<string, unknown>)[key];
      if (value !== undefined) {
        type = (
          type as unknown as Record<
            string,
            (value: unknown) => z.ZodArray<z.ZodTypeAny>
          >
        )[key](value);
      }
    });

    return type;
  },
);

const handleJson = typeHandler((column: JSONColumn) => {
  const type = column.data.schema;
  return jsonItemToZod(type);
});

const jsonItemToZod = (type: JSONTypeAny) => {
  const converter = jsonConverters[type.dataType];
  if (!converter) throw new Error(`Cannot parse column ${type.dataType}`);
  return converter(type);
};

const itemToZod = (item: ColumnType | JSONTypeAny) => {
  return item instanceof ColumnType ? columnToZod(item) : jsonItemToZod(item);
};

const converters: Record<string, (column: ColumnType) => z.ZodType> = {
  varchar: handleString,
  char: handleString,
  text: handleString,
  smallint: handleNumber,
  integer: handleNumber,
  real: handleNumber,
  smallserial: handleNumber,
  serial: handleNumber,
  money: handleNumber,
  bigint: handleBigInt,
  decimal: handleBigInt,
  'double precision': handleBigInt,
  bigserial: handleBigInt,
  bytea: handleBuffer,
  date: handleDate,
  timestamp: handleDate,
  'timestamp with time zone': handleDate,
  time: handleTime,
  'time with time zone': handleTime,
  interval: handleInterval,
  boolean: handleBoolean,
  enum: handleEnum,
  point: handleString,
  line: handleString,
  lseg: handleString,
  box: handleString,
  path: handleString,
  polygon: handleString,
  circle: handleString,
  cidr: handleString,
  inet: handleString,
  macaddr: handleString,
  macaddr8: handleString,
  bit: handleBitString,
  'bit varying': handleBitString,
  tsvector: handleString,
  tsquery: handleString,
  xml: handleString,
  json: handleString,
  uuid: handleUUID,
  array: handleArray,
  jsonb: handleJson,
};

const handleAny = typeHandler(() => {
  return z.any();
});

const handleNaN = typeHandler(() => {
  return z.nan();
});

const handleNever = typeHandler(() => {
  return z.never();
});

const handleNull = typeHandler(() => {
  return z.null();
});

const handleUndefined = typeHandler(() => {
  return z.undefined();
});

const handleUnknown = typeHandler(() => {
  return z.unknown();
});

const handleVoid = typeHandler(() => {
  return z.void();
});

const handleInstanceOf = typeHandler(
  (type: JSONInstanceOf<new () => unknown>) => {
    return z.instanceof(type.class);
  },
);

const handleLiteral = typeHandler((type: JSONTypeAny) => {
  return z.literal((type as JSONLiteral<string>).value);
});

const handleMap = typeHandler((type: JSONMap<JSONTypeAny, JSONTypeAny>) => {
  const { keyType, valueType } = type;
  return z.map(jsonItemToZod(keyType), jsonItemToZod(valueType));
});

const setParams = ['min', 'max', 'size'];
const handleSet = typeHandler((column: JSONSet<JSONTypeAny>) => {
  const { valueType } = column;
  let type = z.set(jsonItemToZod(valueType));
  setParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = (
        type as unknown as Record<
          string,
          (value: unknown) => z.ZodSet<z.ZodTypeAny>
        >
      )[key](value);
    }
  });
  return type;
});

const handleNativeEnum = typeHandler((type: JSONTypeAny) => {
  return z.nativeEnum((type as JSONNativeEnum<EnumLike>).enum);
});

const handleTuple = typeHandler((column: JSONTuple) => {
  let type: z.ZodTuple<[], ZodTypeAny | null> = z.tuple(
    column.items.map((item) => jsonItemToZod(item)) as [],
  );
  if (column.restType) {
    type = type.rest(jsonItemToZod(column.restType));
  }
  return type;
});

const handleObject = typeHandler(
  (type: JSONObject<Record<string, JSONTypeAny>, UnknownKeysParam>) => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const key in type.shape) {
      shape[key] = jsonItemToZod(type.shape[key]);
    }

    let object: z.ZodObject<z.ZodRawShape, UnknownKeysParam, z.ZodTypeAny> =
      z.object(shape);

    if (type.unknownKeys === 'passthrough') {
      object = object.passthrough();
    } else if (type.unknownKeys === 'strict') {
      object = object.strict();
    }

    if (type.catchAllType) {
      object = object.catchall(jsonItemToZod(type.catchAllType));
    }

    return object;
  },
);

const handleRecord = typeHandler(
  (type: JSONRecord<JSONRecordKeyType, JSONTypeAny>) => {
    return z.record(jsonItemToZod(type.keyType), jsonItemToZod(type.valueType));
  },
);

const handleUnion = typeHandler(
  (type: JSONUnion<[JSONTypeAny, JSONTypeAny, ...JSONTypeAny[]]>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return z.union(type.types.map(jsonItemToZod) as any);
  },
);

const handleIntersection = typeHandler(
  (type: JSONIntersection<JSONTypeAny, JSONTypeAny>) => {
    return z.intersection(jsonItemToZod(type.left), jsonItemToZod(type.right));
  },
);

const handleDiscriminatedUnion = typeHandler(
  (
    type: JSONDiscriminatedUnion<
      string,
      Primitive,
      JSONDiscriminatedObject<string, Primitive>
    >,
  ) => {
    return z.discriminatedUnion(
      type.discriminator,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [...type.options.values()].map(jsonItemToZod) as any,
    );
  },
);

const handleLazy = typeHandler((type: JSONLazy<JSONTypeAny>) => {
  return z.lazy(() => jsonItemToZod(type.getter()));
});

const jsonConverters: Record<string, (type: JSONTypeAny) => z.ZodType> = {
  any: handleAny,
  bigint: handleBigInt,
  boolean: handleBoolean,
  date: handleDate,
  nan: handleNaN,
  never: handleNever,
  null: handleNull,
  number: handleNumber,
  string: handleString,
  undefined: handleUndefined,
  unknown: handleUnknown,
  void: handleVoid,
  array: handleArray,
  enum: handleEnum,
  instanceOf: handleInstanceOf,
  literal: handleLiteral,
  map: handleMap,
  set: handleSet,
  nativeEnum: handleNativeEnum,
  tuple: handleTuple,
  object: handleObject,
  record: handleRecord,
  union: handleUnion,
  intersection: handleIntersection,
  discriminatedUnion: handleDiscriminatedUnion,
  lazy: handleLazy,
};
