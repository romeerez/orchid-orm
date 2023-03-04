import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';
import { toArray } from '../../utils';

export interface JSONLazy<T extends JSONTypeAny>
  extends JSONType<T['type'], 'lazy'> {
  data: JSONTypeData & {
    isDeepPartial?: boolean;
  };
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
    toCode(this: JSONLazy<T>, t: string) {
      return toCode(this, t, [
        `${t}.lazy(() => `,
        toArray(this.getter().toCode(t)),
        ')',
      ]);
    },
    deepPartial(this: JSONLazy<T>) {
      return {
        ...this,
        data: {
          ...this.data,
          isDeepPartial: true,
        },
        typeCache: undefined,
        getter: () => this.getter().deepPartial(),
      };
    },
  });
};
