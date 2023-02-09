import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import { JSONNumber, JSONString, scalarTypes } from './scalarTypes';

export interface JSONRecord<
  Key extends JSONRecordKeyType,
  Value extends JSONTypeAny,
> extends JSONType<Record<Key['type'], Value['type']>, 'record'> {
  keyType: Key;
  valueType: Value;
  deepPartial(): JSONRecord<Key, ReturnType<Value['deepPartial']>>;
}

export type JSONRecordKeyType = JSONType<string | number, 'string' | 'number'>;
type Args<Key extends JSONRecordKeyType, Value extends JSONTypeAny> =
  | Args2<Key, Value>
  | Args1<Key>;

type Args2<Key extends JSONRecordKeyType, Value extends JSONTypeAny> = [
  key: Key,
  value: Value,
];
type Args1<Value extends JSONTypeAny> = [value: Value];

export function record<
  KeyType extends JSONString | JSONNumber,
  ValueType extends JSONTypeAny,
>(...args: Args<KeyType, ValueType>): JSONRecord<KeyType, ValueType> {
  const [keyType, valueType] = (
    args.length === 1 ? [scalarTypes.string(), args[0]] : args
  ) as Args2<KeyType, ValueType>;

  return constructType<JSONRecord<KeyType, ValueType>>({
    dataType: 'record',
    keyType,
    valueType,
    toCode(this: JSONRecord<KeyType, ValueType>, t: string) {
      return toCode(
        this,
        t,
        `${t}.record(${
          args.length === 1
            ? this.valueType.toCode(t)
            : `${this.keyType.toCode(t)}, ${this.valueType.toCode(t)}`
        })`,
      );
    },
    deepPartial(this: JSONRecord<KeyType, ValueType>) {
      return {
        ...this,
        valueType: this.valueType.deepPartial(),
      };
    },
  });
}
