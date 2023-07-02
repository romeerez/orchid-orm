import { JSONPrimitive, JSONType } from './jsonType';
import { Code } from '../code';
import { singleQuote } from '../../utils';
import { jsonTypeToCode } from './code';

// JSON literal type. Supports string, number, boolean, or null.
export class JSONLiteral<T extends JSONPrimitive> extends JSONType<
  T,
  { value: T }
> {
  declare kind: 'literal';

  constructor(value: T) {
    super();
    this.data.value = value;
  }

  toCode(t: string): Code {
    const { value } = this.data;
    return jsonTypeToCode(
      this,
      t,
      `${t}.literal(${typeof value === 'string' ? singleQuote(value) : value})`,
    );
  }
}
