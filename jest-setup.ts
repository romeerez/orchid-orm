import dotenv from 'dotenv';
import path from 'path';
import { patchPgForTransactions } from 'pg-transactional-tests';

patchPgForTransactions();

dotenv.config({ path: path.resolve(__dirname, '.env') });
