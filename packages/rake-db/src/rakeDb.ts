import { AdapterOptions } from 'pqb';
import { createDb, dropDb } from './commands/createOrDrop';

export const rakeDb = async (
  adapterOptions: AdapterOptions,
  args: string[] = process.argv.slice(2),
) => {
  const command = args[0].split(':')[0];

  if (command === 'create') {
    await createDb(adapterOptions);
  } else if (command === 'drop') {
    await dropDb(adapterOptions);
  } else {
    console.log(`Usage: rake-db [command] [arguments]`);
  }
};
