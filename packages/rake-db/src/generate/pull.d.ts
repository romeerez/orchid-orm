import { Adapter } from 'pqb/internal';
import { RakeDbConfig } from '../config/config';
export declare const pullDbStructure: (adapter: Adapter, config: RakeDbConfig) => Promise<void>;
