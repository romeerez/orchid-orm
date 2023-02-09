import { Query } from '../query';
import { CopyOptions } from '../sql';

type CopyArg<T extends Query> = CopyOptions<keyof T['shape']>;

export class CopyMethods {
  copy<T extends Query>(this: T, arg: CopyArg<T>): T {
    return this.clone()._copy(arg);
  }
  _copy<T extends Query>(this: T, arg: CopyArg<T>) {
    Object.assign(this.query, {
      type: 'copy',
      copy: arg,
    });
    return this;
  }
}
