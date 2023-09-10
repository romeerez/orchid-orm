import {
  ArrayColumn,
  ColumnsShape,
  ColumnType,
  DateColumn,
  EnumColumn,
  JSONColumn,
  NumberColumn,
  TextColumn,
  VirtualColumn,
} from 'pqb';
import {
  JSONArray,
  JSONEnum,
  JSONLiteral,
  EnumLike,
  JSONNativeEnum,
  JSONNumber,
  JSONString,
  JSONTuple,
  JSONObject,
  UnknownKeysParam,
  JSONDiscriminatedUnion,
  JSONRecord,
  JSONIntersection,
  JSONUnion,
  JSONLazy,
  EmptyObject,
  ColumnTypeBase,
  JSONType,
  JSONBoolean,
  JSONNull,
  JSONUnknown,
  JSONTupleItems,
  JSONObjectShape,
  JSONDiscriminatedUnionArg,
} from 'orchid-core';
import { z, ZodErrorMap, ZodTypeAny } from 'zod';
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

type DateTimeType = 'date' | 'timestamp' | 'timestamptz';

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
  T extends ColumnTypeBase,
  D = T['dataType'],
> = T['data']['isNullable'] extends true
  ? z.ZodNullable<
      SchemaToZod<
        Omit<T, 'data'> & {
          data: Omit<T['data'], 'isNullable'> & { isNullable: false };
        }
      >
    >
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
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends EnumColumn<any, any>
  ? z.ZodEnum<T['options']>
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends ArrayColumn<any>
  ? z.ZodArray<SchemaToZod<T['data']['item']>>
  : T extends JSONColumn<JSONType>
  ? JsonToZod<T['data']['schema']>
  : T extends VirtualColumn
  ? z.ZodNever
  : never;

declare module 'orchid-core' {
  interface JSONType {
    zod: z.ZodTypeAny;
  }

  interface JSONUnknown {
    zod: z.ZodUnknown;
  }

  interface JSONBoolean {
    zod: z.ZodBoolean;
  }

  interface JSONNull {
    zod: z.ZodNull;
  }

  interface JSONNumber {
    zod: z.ZodNumber;
  }

  interface JSONString {
    zod: z.ZodString;
  }
}

type JsonToZod<T extends JSONType> = T['data']['nullable'] extends true
  ? z.ZodNullable<JsonNotNullableToZod<T>>
  : JsonNotNullableToZod<T>;

type JsonNotNullableToZod<T extends JSONType> =
  T['data']['optional'] extends true
    ? z.ZodOptional<JsonNotOptionalToZod<T>>
    : JsonNotOptionalToZod<T>;

type JsonNotOptionalToZod<T extends JSONType> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends JSONUnion<any>
    ? z.ZodUnion<MapUnionArgs<T['data']['types']>>
    : T extends JSONArray<JSONType>
    ? z.ZodArray<JsonToZod<T['data']['item']>>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends JSONEnum<any, any>
    ? z.ZodEnum<T['data']['options']>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends JSONLiteral<any>
    ? z.ZodLiteral<T['data']['value']>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends JSONNativeEnum<any>
    ? z.ZodNativeEnum<T['data']['enum']>
    : T extends JSONTuple<JSONTupleItems, JSONType | undefined>
    ? z.ZodTuple<
        MapJsonTuple<T['data']['items']>,
        T['data']['rest'] extends JSONType ? JsonToZod<T['data']['rest']> : null
      >
    : T extends JSONObject<JSONObjectShape, UnknownKeysParam>
    ? z.ZodObject<
        { [K in keyof T['data']['shape']]: JsonToZod<T['data']['shape'][K]> },
        T['data']['unknownKeys'],
        JsonToZod<T['data']['catchAll']>
      >
    : T extends JSONRecord<JSONString | JSONNumber, JSONType>
    ? T['data']['key'] extends JSONString
      ? z.ZodRecord<z.ZodString, JsonToZod<T['data']['value']>>
      : z.ZodRecord<z.ZodNumber, JsonToZod<T['data']['value']>>
    : T extends JSONIntersection<JSONType, JSONType>
    ? z.ZodIntersection<
        JsonToZod<T['data']['left']>,
        JsonToZod<T['data']['right']>
      >
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends JSONDiscriminatedUnion<string, any>
    ? MapDiscriminatedUnion<T>
    : T['zod'];

export type MapDiscriminatedUnion<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends JSONDiscriminatedUnion<string, any>,
  Options = MapJsonTuple<T['data']['types']>,
> = z.ZodDiscriminatedUnion<
  T['data']['discriminator'],
  Options extends z.ZodDiscriminatedUnionOption<T['data']['discriminator']>[]
    ? Options
    : never
>;

type MapUnionArgs<T extends unknown[]> = T extends [
  infer F extends JSONType,
  infer S extends JSONType,
  ...infer Tail,
]
  ? [JsonToZod<F>, JsonToZod<S>, ...MapJsonTuple<Tail>]
  : never;

type MapJsonTuple<T extends unknown[]> = T extends [infer Head, ...infer Tail]
  ? [Head extends JSONType ? JsonToZod<Head> : never, ...MapJsonTuple<Tail>]
  : [];

type Columns = { shape: ColumnsShape };
type Table = { columns: ColumnsShape };
type TableClass<T extends Table> = { new (): T };

export type InstanceToZod<T extends Columns> = z.ZodObject<{
  [K in keyof T['shape']]: SchemaToZod<T['shape'][K]>;
}>;

export const instanceToZod = <T extends Columns>({
  shape,
}: T): InstanceToZod<T> => {
  const result = {} as z.ZodRawShape;
  for (const key in shape) {
    const column = shape[key];
    if (!(column instanceof VirtualColumn)) {
      result[key as keyof typeof result] = columnToZod(column);
    }
  }

  return z.object(result) as InstanceToZod<T>;
};

export const zodSchemaProvider = function <T extends Table>(
  this: TableClass<T>,
): InstanceToZod<{ shape: T['columns'] }> {
  return instanceToZod({
    shape: this.prototype.columns,
  }) as unknown as InstanceToZod<{
    shape: T['columns'];
  }>;
};

export const columnToZod = <T extends ColumnType>(
  column: T,
): SchemaToZod<T> => {
  const dataType = column.data.as?.dataType || column.dataType;
  const converter = converters[dataType];
  if (!converter) {
    if (column instanceof VirtualColumn) {
      return handleNever(column) as SchemaToZod<T>;
    }
    throw new Error(`Cannot parse column ${dataType}`);
  }
  return converter(column) as SchemaToZod<T>;
};

const typeHandler = <Type extends ColumnType | JSONType>(
  fn: (column: Type, errors?: Record<string, string>) => z.ZodTypeAny,
) => {
  return (column: ColumnType | JSONType): z.ZodTypeAny => {
    let type = fn(column as Type, column.data.errors);

    const { errors } = column.data;
    const { required_error, invalid_type_error } = {
      required_error: errors?.required,
      invalid_type_error: errors?.invalidType,
    };

    // copy-pasted from Zod source, may break in future
    type._def.errorMap = ((iss, ctx) => {
      if (iss.code !== 'invalid_type') return { message: ctx.defaultError };
      if (ctx.data === undefined) {
        return { message: required_error ?? ctx.defaultError };
      }
      return { message: invalid_type_error ?? ctx.defaultError };
    }) as ZodErrorMap;

    const chain =
      column instanceof ColumnType ? column.chain : column.data.chain;
    if (chain) {
      for (const item of chain) {
        if (item[0] === 'transform') {
          type = type.transform(item[1]);
        } else if (item[0] === 'to') {
          type = z.preprocess(item[1], itemToZod(item[2]));
        } else if (item[0] === 'refine') {
          type = type.refine(item[1], { message: errors?.refine });
        } else if (item[0] === 'superRefine') {
          type = type.superRefine(item[1]);
        }
      }
    }

    if (
      ('nullable' in column.data && column.data.nullable) ||
      (column as ColumnType).data.isNullable
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
  'includes',
  'startsWith',
  'endsWith',
];

const stringEmptyParams = [
  'email',
  'url',
  'emoji',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'trim',
  'toLowerCase',
  'toUpperCase',
];

const stringObjectParams = ['datetime', 'ip'];

const handleString = typeHandler((column: TextColumn | JSONString, errors) => {
  let type = z.string();
  const data = column.data;

  stringParams.forEach((key) => {
    const value = (data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = type[key as 'min'](value as number, { message: errors?.[key] });
    }
  });

  stringEmptyParams.forEach((key) => {
    const value = (data as Record<string, unknown>)[key];
    if (value) {
      type = type[key as 'email']({ message: errors?.[key] });
    }
  });

  stringObjectParams.forEach((key) => {
    const value = (data as Record<string, unknown>)[key];
    if (value) {
      type = type[key as 'datetime'](value as EmptyObject);
    }
  });

  const { maxChars } = data as { maxChars?: number };
  if (maxChars !== undefined) {
    type = type.max(maxChars, { message: errors?.length });
  }

  return type;
});

const numberParams = ['lt', 'lte', 'gt', 'gte', 'step'];

const numberEmptyParams = ['finite', 'safe'];

const handleNumber = typeHandler(
  (column: NumberColumn | JSONNumber, errors) => {
    let type = z.number();
    numberParams.forEach((key) => {
      const value = (column.data as Record<string, unknown>)[key];
      if (value !== undefined) {
        type = type[key as 'min'](value as number, { message: errors?.[key] });
      }
    });

    numberEmptyParams.forEach((key) => {
      const value = (column.data as Record<string, unknown>)[key];
      if (value) {
        type = type[key as 'finite']({ message: errors?.[key] });
      }
    });

    if ((column.data as Record<'int', boolean>).int) {
      type = type.int({ message: errors?.int });
    }

    return type;
  },
);

const handleBigInt = typeHandler((_, errors) => {
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
      message: errors?.invalidType || 'Failed to parse bigint',
    },
  );
});

const handleBuffer = typeHandler(() => {
  return z.instanceof(Buffer);
});

const dateParams = ['min', 'max'];
const handleDate = typeHandler((column: DateColumn, errors) => {
  let type = z.date();
  dateParams.forEach((key) => {
    const value = (column.data as Record<string, unknown>)[key];
    if (value !== undefined) {
      type = type[key as 'min'](value as Date, { message: errors?.[key] });
    }
  });

  return z.preprocess(
    (val) =>
      typeof val === 'string' || typeof val === 'number' ? new Date(val) : val,
    type,
  );
});

const handleTime = typeHandler((_, errors) => {
  return z.string().refine(
    (val) => {
      return !isNaN(new Date(`2000-01-01 ${val}`).getTime());
    },
    {
      message: errors?.invalidType || 'Invalid time',
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

const handleInterval = typeHandler(() => interval);

const handleBoolean = typeHandler(() => z.boolean());

const handleEnum = typeHandler(
  (column: EnumColumn | JSONEnum<string, [string, ...string[]]>) => {
    const enumColumn = column as
      | EnumColumn<string, [string, ...string[]]>
      | JSONEnum<string, [string, ...string[]]>;

    const options =
      enumColumn instanceof EnumColumn
        ? enumColumn.options
        : enumColumn.data.options;

    return z.enum(options);
  },
);

const handleBitString = typeHandler((_, errors) => {
  return z.string().regex(/[10]/g, { message: errors?.invalidType });
});

const handleUUID = typeHandler((_, errors) => {
  return z.string().uuid({ message: errors?.invalidType });
});

const arrayParams = ['min', 'max', 'length'];
const handleArray = typeHandler(
  (array: ArrayColumn<ColumnType> | JSONArray<JSONType>, errors) => {
    let type: z.ZodArray<z.ZodTypeAny>;
    if (array instanceof ColumnType) {
      type = z.array(columnToZod(array.data.item));
    } else {
      type = z.array(jsonItemToZod(array.data.item));
    }

    arrayParams.forEach((key) => {
      const value = (array.data as Record<string, unknown>)[key];
      if (value !== undefined) {
        type = type[key as 'min'](value as number, { message: errors?.[key] });
      }
    });

    return type;
  },
);

const handleJson = typeHandler((column: JSONColumn) => {
  const type = column.data.schema;
  column.data.errors = column.data.schema.data.errors;
  return jsonItemToZod(type);
});

const jsonItemToZod = (type: JSONType): z.ZodTypeAny => {
  if (type instanceof JSONUnknown) {
    return handleUnknown(type);
  } else if (type instanceof JSONBoolean) {
    return handleBoolean(type);
  } else if (type instanceof JSONNull) {
    return handleNull(type);
  } else if (type instanceof JSONNumber) {
    return handleNumber(type);
  } else if (type instanceof JSONString) {
    return handleString(type);
  } else if (type instanceof JSONArray) {
    return handleArray(type);
  } else if (type instanceof JSONObject) {
    return handleObject(type);
  } else if (type instanceof JSONLiteral) {
    return handleLiteral(type);
  } else if (type instanceof JSONDiscriminatedUnion) {
    return handleDiscriminatedUnion(type);
  } else if (type instanceof JSONEnum) {
    return handleEnum(type);
  } else if (type instanceof JSONIntersection) {
    return handleIntersection(type);
  } else if (type instanceof JSONLazy) {
    return handleLazy(type);
  } else if (type instanceof JSONNativeEnum) {
    return handleNativeEnum(type);
  } else if (type instanceof JSONRecord) {
    return handleRecord(type);
  } else if (type instanceof JSONTuple) {
    return handleTuple(type);
  } else if (type instanceof JSONUnion) {
    return handleUnion(type);
  } else {
    throw new Error(`Cannot parse column ${type.constructor.name}`);
  }
};

const itemToZod = (item: ColumnType | JSONType) => {
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
  timestamptz: handleDate,
  time: handleTime,
  timetz: handleTime,
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

const handleNever = typeHandler(() => z.never());

const handleNull = typeHandler(() => z.null());

const handleUnknown = typeHandler(() => z.unknown());

const handleLiteral = typeHandler((type: JSONType) => {
  return z.literal((type as JSONLiteral<string>).data.value);
});

const handleNativeEnum = typeHandler((type: JSONType) => {
  return z.nativeEnum((type as JSONNativeEnum<EnumLike>).data.enum);
});

const handleTuple = typeHandler((column: JSONTuple<JSONTupleItems>) => {
  let type: z.ZodTuple<[], ZodTypeAny | null> = z.tuple(
    column.data.items.map((item) => jsonItemToZod(item)) as [],
  );
  if (column.data.rest) {
    type = type.rest(jsonItemToZod(column.data.rest));
  }
  return type;
});

const handleObject = typeHandler(
  (type: JSONObject<Record<string, JSONType>, UnknownKeysParam>, errors) => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const key in type.data.shape) {
      shape[key] = jsonItemToZod(type.data.shape[key]);
    }

    let object: z.ZodObject<z.ZodRawShape, UnknownKeysParam, z.ZodTypeAny> =
      z.object(shape);

    if (type.data.unknownKeys === 'passthrough') {
      object = object.passthrough();
    } else if (type.data.unknownKeys === 'strict') {
      object = object.strict(errors?.strict);
    }

    if (type.data.catchAll) {
      object = object.catchall(jsonItemToZod(type.data.catchAll));
    }

    return object;
  },
);

const handleRecord = typeHandler(
  (type: JSONRecord<JSONString | JSONNumber, JSONType>) => {
    return z.record(
      jsonItemToZod(type.data.key),
      jsonItemToZod(type.data.value),
    );
  },
);

const handleUnion = typeHandler(
  (type: JSONUnion<[JSONType, JSONType, ...JSONType[]]>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return z.union(type.data.types.map(jsonItemToZod) as any);
  },
);

const handleIntersection = typeHandler(
  (type: JSONIntersection<JSONType, JSONType>) => {
    return z.intersection(
      jsonItemToZod(type.data.left),
      jsonItemToZod(type.data.right),
    );
  },
);

const handleDiscriminatedUnion = typeHandler(
  (type: JSONDiscriminatedUnion<string, JSONDiscriminatedUnionArg<string>>) => {
    return z.discriminatedUnion(
      type.data.discriminator,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [...type.data.types].map(jsonItemToZod) as any,
    );
  },
);

const handleLazy = typeHandler((type: JSONLazy<JSONType>) => {
  return z.lazy(() => jsonItemToZod(type.getType()));
});
