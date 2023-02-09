import { Query } from '../query';
import { pushQueryArray } from '../queryDataUtils';
import { RawExpression } from '../raw';

export type UnionArg<T extends Query> =
  | (Omit<Query, 'result'> & { result: T['result'] })
  | RawExpression;

export class Union {
  union<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return this._union(args, wrap);
  }

  _union<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'UNION' as const, wrap })),
    );
  }

  unionAll<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return this._unionAll(args, wrap);
  }

  _unionAll<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'UNION ALL' as const, wrap })),
    );
  }

  intersect<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return this._intersect(args, wrap);
  }

  _intersect<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT' as const, wrap })),
    );
  }

  intersectAll<T extends Query>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return this._intersectAll(args, wrap);
  }

  _intersectAll<T extends Query>(
    this: T,
    args: UnionArg<T>[],
    wrap?: boolean,
  ): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'INTERSECT ALL' as const, wrap })),
    );
  }

  except<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return this._except(args, wrap);
  }

  _except<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT' as const, wrap })),
    );
  }

  exceptAll<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return this._exceptAll(args, wrap);
  }

  _exceptAll<T extends Query>(this: T, args: UnionArg<T>[], wrap?: boolean): T {
    return pushQueryArray(
      this,
      'union',
      args.map((arg) => ({ arg, kind: 'EXCEPT ALL' as const, wrap })),
    );
  }
}
