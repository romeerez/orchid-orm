export type ClearStatement = 'with' | 'select' | 'where' | 'union' | 'using' | 'join' | 'group' | 'order' | 'having' | 'limit' | 'offset' | 'counters';
export declare class Clear {
    clear<T>(this: T, ...clears: ClearStatement[]): T;
}
