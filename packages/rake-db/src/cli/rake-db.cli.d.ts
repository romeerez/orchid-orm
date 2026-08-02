import { Adapter, ColumnSchemaConfig, DefaultColumnTypes, DefaultSchemaConfig, MaybeArray } from 'pqb/internal';
import { RakeDbCliConfigInput, RakeDbConfig } from '../config/config';
import { MigrationChangeFn } from '../migration/change';
export interface RakeDbCliResult<ColumnTypes, Options> {
    change: MigrationChangeFn<ColumnTypes>;
    run(options: Options, args?: string[]): Promise<void>;
}
export interface RakeDbFn<Options> {
    <SchemaConfig extends ColumnSchemaConfig, ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>>(config: RakeDbCliConfigInput<SchemaConfig, ColumnTypes> | RakeDbConfig<ColumnTypes>, args?: string[]): RakeDbCliResult<ColumnTypes, Options>;
    run<SchemaConfig extends ColumnSchemaConfig, ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>>(options: Options, config: RakeDbCliConfigInput<SchemaConfig, ColumnTypes> | RakeDbConfig<ColumnTypes>, args?: string[]): MigrationChangeFn<ColumnTypes>;
}
export declare const rakeDbCliWithAdapter: RakeDbFn<MaybeArray<Adapter>>;
export declare const setRakeDbCliRunFn: <T>(rakeDbCli: RakeDbFn<T>) => void;
