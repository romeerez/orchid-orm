import { constructType, JSONType, JSONTypeAny } from './typeBase';

export interface JSONMap<Key extends JSONTypeAny, Value extends JSONTypeAny>
  extends JSONType<Map<Key['type'], Value['type']>, 'map'> {
  keyType: Key;
  valueType: Value;
  deepPartial(): JSONMap<
    ReturnType<Key['deepPartial']>,
    ReturnType<Value['deepPartial']>
  >;
}

export const map = <Key extends JSONTypeAny, Value extends JSONTypeAny>(
  keyType: Key,
  valueType: Value,
) => {
  return constructType<JSONMap<Key, Value>>({
    dataType: 'map',
    keyType: keyType,
    valueType: valueType,
    deepPartial(this: JSONMap<Key, Value>) {
      return {
        ...this,
        keyType: this.keyType.deepPartial(),
        valueType: this.valueType.deepPartial(),
      };
    },
  });
};
