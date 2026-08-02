import { ColumnSchemaConfig } from 'pqb/internal';
import { RakeDbCliConfigInput, RakeDbCommands, RakeDbConfig } from './config';
export declare const rakeDbCommands: RakeDbCommands;
export declare const incrementIntermediateCaller: () => void;
export declare const makeRakeDbConfig: <ColumnTypes>(config: RakeDbCliConfigInput<ColumnSchemaConfig, ColumnTypes>, args?: string[]) => RakeDbConfig<ColumnTypes>;
