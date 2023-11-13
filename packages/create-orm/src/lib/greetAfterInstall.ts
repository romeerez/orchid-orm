import { relative } from 'path';
import { InitConfig } from '../lib';
import { getPackageManagerName } from './utils';

export function greetAfterInstall(
  config: InitConfig,
  logger: { log(message: string): void } = console,
) {
  const relativePath = relative(process.cwd(), config.path);
  const manager = getPackageManagerName();
  const run = manager === 'npm' ? `npm run` : manager;

  logger.log(`
Thank you for trying Orchid ORM!
  
To finish setup,${
    relativePath ? ` cd to the project and` : ''
  } install dependencies:
${
  relativePath
    ? `
> cd ${relativePath}`
    : ''
}
> ${manager} i

Enter the correct database credentials to the .env file,
then create the database:

> ${run} db create

And run the migrations:

> ${run} db migrate
`);
}
