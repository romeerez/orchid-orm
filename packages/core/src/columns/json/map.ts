import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';

// JSON type for ES6 Map (probably will be removed as it doesn't make sense for JSON)
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

// ES6 Map JSON type constructor
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
