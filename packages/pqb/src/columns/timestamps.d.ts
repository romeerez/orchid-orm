import { Column } from './column';
export interface Timestamps<T extends Column.Pick.Data> {
    createdAt: Column.HasDefault<T>;
    updatedAt: Column.HasDefault<T>;
}
export interface TimestampHelpers {
    /**
     * Add `createdAt` and `updatedAt` timestamps. Both have `now()` as a default, `updatedAt` is automatically updated during update.
     */
    timestamps<T extends Column.Pick.Data>(this: {
        timestamp(): T;
    }): Timestamps<T>;
    /**
     * The same as {@link timestamps}, for the timestamp without time zone time.
     */
    timestampsNoTZ<T extends Column.Pick.Data>(this: {
        timestampNoTZ(): T;
    }): Timestamps<T>;
}
export declare const timestampHelpers: TimestampHelpers;
