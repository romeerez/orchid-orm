import { constructType, JSONType, toCode } from './typeBase';

export interface JSONInstanceOf<T extends Class>
  extends JSONType<T, 'instanceOf'> {
  class: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Class = new (...args: any[]) => any;

export const instanceOf = <T extends Class>(cls: T) => {
  return constructType<JSONInstanceOf<T>>({
    dataType: 'instanceOf',
    class: cls,
    toCode(this: JSONInstanceOf<T>, t: string) {
      return toCode(this, t, `${t}.instanceOf(${this.class.name})`);
    },
  });
};
