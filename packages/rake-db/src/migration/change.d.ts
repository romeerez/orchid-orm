import { DbMigration } from './migration';
export interface RakeDbChangeFnConfig<ColumnTypes> {
    columnTypes: ColumnTypes;
}
/**
 * Function to use in migrations to wrap database changes
 * Saves the given callback to an internal queue,
 * and also returns the callback in case you want to export it from migration.
 */
export interface MigrationChangeFn<ColumnTypes> {
    (fn: ChangeCallback<ColumnTypes>): MigrationChange;
}
export declare const createMigrationChangeFn: <ColumnTypes>(config: RakeDbChangeFnConfig<ColumnTypes>) => MigrationChangeFn<ColumnTypes>;
export interface MigrationChange {
    fn: ChangeCallback<unknown>;
    config: RakeDbChangeFnConfig<unknown>;
}
export type ChangeCallback<ColumnTypes> = (db: DbMigration<ColumnTypes>, up: boolean) => Promise<void>;
export declare const clearChanges: () => void;
export declare const getCurrentChanges: () => MigrationChange[];
export declare const pushChange: (change: MigrationChange) => number;
