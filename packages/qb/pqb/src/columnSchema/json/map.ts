import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';

export interface JSONMap<Key extends JSONTypeAny, Value extends JSONTypeAny>
  extends JSONType<Map<Key['type'], Value['type']>, 'map'> {
  data: JSONTypeData & {
    isDeepPartial?: boolean;
  };
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
    toCode(this: JSONMap<Key, Value>, t: string) {
      return toCode(
        this,
        t,
        `${t}.map(${this.keyType.toCode(t)}, ${this.valueType.toCode(t)})`,
      );
    },
    deepPartial(this: JSONMap<Key, Value>) {
      return {
        ...this,
        data: {
          ...this.data,
          isDeepPartial: true,
        },
        keyType: this.keyType.deepPartial(),
        valueType: this.valueType.deepPartial(),
      };
    },
  });
};
