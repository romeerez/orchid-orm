import { Query } from '../query';
export interface QueryInternalColumnNameToKey {
    columnNameToKeyMap?: Map<string, string>;
}
/**
 * In snake case mode, or when columns have custom names,
 * use this method to exchange a db column name to its runtime key.
 */
export declare const queryColumnNameToKey: (q: Query, name: string) => string | undefined;
