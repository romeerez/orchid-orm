import { constructType, JSONType, JSONTypeAny } from './typeBase';

export interface JSONLazy<T extends JSONTypeAny>
  extends JSONType<T['type'], 'lazy'> {
  typeCache?: T;
  getter(): T;
  deepPartial(): JSONLazy<ReturnType<T['deepPartial']>>;
}

export const lazy = <T extends JSONTypeAny>(fn: () => T) => {
  constructType<JSONLazy<T>>({
    dataType: 'lazy',
    getter: fn,
    deepPartial(this: JSONLazy<T>) {
      return {
        ...this,
        typeCache: undefined,
        getter: () => this.getter().deepPartial(),
      };
    },
  });
};
