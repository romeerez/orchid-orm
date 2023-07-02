import { JSONDeepPartial, JSONType } from './jsonType';
import { Code } from '../code';
import { toArray } from '../../utils';
import { jsonTypeToCode } from './code';

// JSON type wrapper for recursive types
export class JSONLazy<T extends JSONType> extends JSONType<
  T['type'],
  { fn: () => T; type?: T }
> {
  declare kind: 'lazy';

  constructor(fn: () => T) {
    super();
    this.data.fn = fn;
  }

  // get the JSON type from a function provided to a `lazy`, it's being memoized.
  getType(): T {
    return (this.data.type ??= this.data.fn());
  }

  toCode(t: string): Code {
    return jsonTypeToCode(this, t, [
      `${t}.lazy(() => `,
      toArray(this.getType().toCode(t)),
      ')',
    ]);
  }

  deepPartial(): JSONLazy<JSONDeepPartial<T>> {
    const type = new JSONLazy(() => this.data.fn().deepPartial()) as JSONLazy<
      JSONDeepPartial<T>
    >;
    type.data.isDeepPartial = true;
    return type;
  }
}
