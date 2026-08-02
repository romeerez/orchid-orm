import { RakeDbAst } from '../ast';
import { RakeDbConfig } from '../config/config';
export interface GenerateItem {
    ast: RakeDbAst;
    add: Set<string>;
    drop: Set<string>;
    deps: Set<string>;
}
export declare const astToGenerateItems: (config: RakeDbConfig, asts: RakeDbAst[], currentSchema: string) => GenerateItem[];
export declare const astToGenerateItem: (config: RakeDbConfig, ast: RakeDbAst, currentSchema: string) => GenerateItem;
