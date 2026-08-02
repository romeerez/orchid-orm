import { RakeDbConfig } from '../config/config';
import { Adapter } from 'pqb/internal';
export declare const rebase: (adapters: Adapter[], config: RakeDbConfig) => Promise<void>;
