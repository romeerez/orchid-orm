import { RakeDbAst } from '../ast';
import { RakeDbConfig } from '../config/config';
export declare const astToMigration: (currentSchema: string, config: RakeDbConfig, asts: RakeDbAst[]) => string | undefined;
