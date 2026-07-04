import postgres from 'postgres';

interface PostgresJsParser {
  (input: string): unknown;
  array?: boolean;
}

interface PostgresJsOptionsWithArrays extends postgres.ParsedOptions {
  shared: {
    typeArrayMap: Record<number, number>;
  };
  parsers: Record<number, PostgresJsParser>;
}

export const patchPostgresJsArrayParsers = (sql: postgres.Sql): void => {
  const options = sql.options as PostgresJsOptionsWithArrays;
  const { parsers } = options;
  const serializers = options.serializers;

  options.serializers = new Proxy(serializers, {
    set(target, property, value, receiver) {
      const result = Reflect.set(target, property, value, receiver);
      if (typeof property === 'symbol') return result;

      const typarray = Number(property);
      if (!Number.isInteger(typarray) || !parsers[typarray]?.array) {
        return result;
      }

      const oid = findTypeOidByArrayOid(options.shared.typeArrayMap, typarray);
      if (!oid) return result;

      const itemParser = parsers[oid];
      const arrayParser: PostgresJsParser = (input) =>
        parsePostgresArray(input, itemParser, typarray);
      arrayParser.array = true;
      parsers[typarray] = arrayParser;

      return result;
    },
  });
};

const findTypeOidByArrayOid = (
  typeArrayMap: Record<number, number>,
  typarray: number,
): number | undefined => {
  for (const oid in typeArrayMap) {
    if (typeArrayMap[oid] === typarray) return Number(oid);
  }

  return undefined;
};

interface ArrayParserState {
  i: number;
  char: string | null;
  str: string;
  quoted: boolean;
  last: number;
  p?: string | null;
}

const parsePostgresArray = (
  input: string,
  parser: PostgresJsParser | undefined,
  typarray: number,
): unknown[] => {
  return parsePostgresArrayLoop(
    {
      i: 0,
      char: null,
      str: '',
      quoted: false,
      last: 0,
    },
    input,
    parser,
    typarray,
  );
};

const parsePostgresArrayLoop = (
  state: ArrayParserState,
  input: string,
  parser: PostgresJsParser | undefined,
  typarray: number,
): unknown[] => {
  const result: unknown[] = [];
  // Only _box (1020) has the ';' delimiter for arrays, all other types use ','.
  const delimiter = typarray === 1020 ? ';' : ',';

  for (; state.i < input.length; state.i++) {
    state.char = input[state.i];
    if (state.quoted) {
      if (state.char === '\\') {
        state.str += input[++state.i];
      } else if (state.char === '"') {
        result.push(parser ? parser(state.str) : state.str);
        state.str = '';
        state.quoted = input[state.i + 1] === '"';
        state.last = state.i + 2;
      } else {
        state.str += state.char;
      }
    } else if (state.char === '"') {
      state.quoted = true;
    } else if (state.char === '{') {
      state.last = ++state.i;
      result.push(parsePostgresArrayLoop(state, input, parser, typarray));
    } else if (state.char === '}') {
      state.quoted = false;
      if (state.last < state.i) {
        result.push(parseArrayValue(input.slice(state.last, state.i), parser));
      }
      state.last = state.i + 1;
      break;
    } else if (state.char === delimiter && state.p !== '}' && state.p !== '"') {
      result.push(parseArrayValue(input.slice(state.last, state.i), parser));
      state.last = state.i + 1;
    }

    state.p = state.char;
  }

  if (state.last < state.i) {
    result.push(parseArrayValue(input.slice(state.last, state.i + 1), parser));
  }

  return result;
};

const parseArrayValue = (
  input: string,
  parser: PostgresJsParser | undefined,
): unknown => {
  return input === 'NULL' ? null : parser ? parser(input) : input;
};
