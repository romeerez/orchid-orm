import { constructType, JSONType, JSONTypeAny } from './typeBase';

export interface JSONLazy<T extends JSONTypeAny>
  extends JSONType<T['type'], 'lazy'> {
  typeCache?: T;
  getter(): T;
  deepPartial(): JSONLazy<ReturnType<T['deepPartial']>>;
}

export const lazy = <T extends JSONTypeAny>(fn: () => T): JSONLazy<T> => {
  return constructType<JSONLazy<T>>({
    dataType: 'lazy',
    getter() {
      return this.typeCache || (this.typeCache = fn());
    },
    deepPartial(this: JSONLazy<T>) {
      return {
        ...this,
        typeCache: undefined,
        getter: () => this.getter().deepPartial(),
      };
    },
  });
};
