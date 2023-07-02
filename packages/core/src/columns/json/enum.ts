// JSON enum type that consists of strings
import { Code } from '../code';
import { singleQuoteArray } from '../../utils';
import { JSONType } from './jsonType';
import { jsonTypeToCode } from './code';

// JSON enum type consisting of string literals
export class JSONEnum<U extends string, T extends [U, ...U[]]> extends JSONType<
  T[number],
  { options: T }
> {
  declare kind: 'enum';

  constructor(options: T) {
    super();
    this.data.options = options;
  }

  toCode(t: string): Code {
    return jsonTypeToCode(
      this,
      t,
      `${t}.enum(${singleQuoteArray(this.data.options)})`,
    );
  }
}
