import { SetQueryReturnsColumnOptional } from '../../query';
import { Column } from '../../../columns/column';
export declare function queryJson<T>(self: T, coalesce?: boolean): SetQueryReturnsColumnOptional<T, Column.Pick.QueryColumnOfType<string>>;
