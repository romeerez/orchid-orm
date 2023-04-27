import { SetQueryTableAlias } from '../query';
import { QueryBase } from '../queryBase';

export abstract class AsMethods extends QueryBase {
  as<T extends AsMethods, As extends string>(
    this: T,
    as: As,
  ): SetQueryTableAlias<T, As> {
    return this.clone()._as(as) as unknown as SetQueryTableAlias<T, As>;
  }

  _as<T extends AsMethods, As extends string>(
    this: T,
    as: As,
  ): SetQueryTableAlias<T, As> {
    this.query.as = as;
    return this as unknown as SetQueryTableAlias<T, As>;
  }
}
