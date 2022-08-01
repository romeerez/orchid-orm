import { constructType, JSONType, JSONTypeAny } from './typeBase';
import { JSONNumber, JSONString, scalarTypes } from './scalarTypes';

export interface JSONRecord<Key extends KeyType, Value extends JSONTypeAny>
  extends JSONType<Record<Key['type'], Value['type']>, 'record'> {
  keyType: Key;
  valueType: Value;
  deepPartial(): JSONRecord<Key, ReturnType<Value['deepPartial']>>;
}

type KeyType = JSONType<string | number, 'string' | 'number'>;
type Args<Key extends KeyType, Value extends JSONTypeAny> =
  | Args2<Key, Value>
  | Args1<Key>;

type Args2<Key extends KeyType, Value extends JSONTypeAny> = [
  key: Key,
  value: Value,
];
type Args1<Value extends JSONTypeAny> = [value: Value];

export function record(
  ...args: Args<JSONString | JSONNumber, JSONTypeAny>
): JSONRecord<JSONString | JSONNumber, JSONTypeAny> {
  const [keyType, valueType] = (
    args.length === 1 ? [scalarTypes.string(), args[0]] : args
  ) as Args2<JSONString | JSONNumber, JSONTypeAny>;

  return constructType<JSONRecord<JSONString | JSONNumber, JSONTypeAny>>({
    dataType: 'record',
    keyType,
    valueType,
    deepPartial(this: JSONRecord<JSONString, JSONTypeAny>) {
      return {
        ...this,
        valueType: this.valueType.deepPartial(),
      };
    },
  });
}
