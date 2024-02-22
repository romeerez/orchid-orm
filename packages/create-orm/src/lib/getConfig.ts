import prompts from 'prompts';
import { join, resolve, basename } from 'path';
import { InitConfig, UserProvidedConfig } from '../lib';
import { getPackageManagerName, readFileSafe } from './utils';

export async function getConfig(
  logger: { log(message: string): void } = console,
): Promise<InitConfig | undefined> {
  let cancelled = false;

  logger.log('Welcome to Orchid ORM installer!');

  const isBun = getPackageManagerName() === 'bun';

  const response = await prompts<keyof UserProvidedConfig>(
    [
      {
        type: 'text',
        name: 'path',
        message: 'Where to install Orchid ORM?',
        initial: process.cwd(),
      },
      ...(isBun
        ? []
        : [
            {
              type: 'select' as const,
              name: 'runner' as const,
              message: 'Choose a tool for executing TS files',
              choices: [
                {
                  title: 'tsx',
                  value: 'tsx',
                },
                {
                  title: 'vite-node',
                  value: 'vite-node',
                },
                {
                  title: 'ts-node',
                  value: 'ts-node',
                },
              ],
            },
          ]),
      {
        type: 'select',
        name: 'timestamp',
        message: 'Return timestamps as:',
        choices: [
          {
            title: 'string (as returned from db)',
            value: 'string',
          },
          {
            title: 'number (epoch)',
            value: 'number',
          },
          {
            title: 'Date object',
            value: 'date',
          },
        ],
      },
      {
        type: 'confirm',
        name: 'testDatabase',
        message: 'Add a separate database for tests?',
      },
      {
        type: 'select',
        name: 'validation',
        message: 'Integrate with a validation library?',
        choices: [
          {
            title: 'no',
            value: 'no',
          },
          {
            title: 'zod',
            value: 'zod',
          },
          {
            title: 'valibot',
            value: 'valibot',
          },
        ],
      },
      {
        type: 'confirm',
        name: 'addTestFactory',
        message: 'Add record factories for writing tests?',
      },
      {
        type: 'confirm',
        name: 'demoTables',
        message: 'Add demo tables?',
      },
    ],
    {
      onCancel() {
        cancelled = true;
      },
    },
  );

  if (isBun) response.runner = 'bun';

  if (cancelled) return;

  const path = resolve(response.path);
  const tsConfigPath = join(path, 'tsconfig.json');
  const hasTsConfig = await readFileSafe(tsConfigPath);
  const dbDirPath = join(path, 'src', 'db');

  return {
    ...response,
    hasTsConfig: !!hasTsConfig,
    path: resolve(response.path),
    dbDirPath,
    projectName: basename(path),
    esm: response.runner !== 'ts-node',
  };
}
