import { JSONNumber, JSONString } from './scalarTypes';
import { JSONDeepPartial, JSONType } from './jsonType';
import { Code } from '../code';
import { jsonTypeToCode } from './code';

// JSON record type. Supports string or number JSON type for a key type, any JSON type for the value.
// String key is a default.
export class JSONRecord<
  Key extends JSONString | JSONNumber,
  Value extends JSONType,
> extends JSONType<
  Record<Key['type'], Value['type']>,
  {
    key: Key;
    value: Value;
  }
> {
  declare kind: 'record';

  constructor(...args: [value: Value] | [key: Key, value: Value]) {
    super();
    if (args.length === 1) {
      this.data.key = new JSONString() as Key;
      this.data.value = args[0];
    } else {
      this.data.key = args[0];
      this.data.value = args[1];
    }
  }

  toCode(t: string): Code {
    return jsonTypeToCode(
      this,
      t,
      `${t}.record(${
        this.data.key instanceof JSONString
          ? this.data.value.toCode(t)
          : `${this.data.key.toCode(t)}, ${this.data.value.toCode(t)}`
      })`,
    );
  }

  deepPartial(): JSONRecord<Key, JSONDeepPartial<Value>> {
    return new JSONRecord(
      this.data.key,
      this.data.value.deepPartial(),
    ) as JSONRecord<Key, JSONDeepPartial<Value>>;
  }
}
