import { rakeDbCommands } from 'rake-db';
import { generate } from './generate/generate';

rakeDbCommands.g = rakeDbCommands.generate = {
  run: generate,
  help: 'gen migration from OrchidORM tables',
  helpArguments: {
    'no arguments': '"generated" is a default file name',
    'migration-name': 'set migration file name',
    up: 'auto-apply migration',
    'migration-name up': 'with a custom name and apply it',
  },
  helpAfter: 'reset',
};
