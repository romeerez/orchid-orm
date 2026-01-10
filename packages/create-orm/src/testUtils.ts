import { InitConfig } from './lib';
import { resolve } from 'path';

export const asMock = (fn: unknown) => fn as jest.Mock;

export class EnoentError extends Error {
  code = 'ENOENT';
}

type FunctionProperties<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
  }[keyof T]]: T[K];
};
type FunctionPropertyNames<T> = keyof FunctionProperties<T>;

function noop() {}

export function mockFn<
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends {},
  M extends FunctionPropertyNames<Required<T>>,
>(object: T, method: M): jest.Mock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object[method] = noop as any;

  return (
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(object, method as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(noop as any) as unknown as jest.Mock
  );
}

export const testInitConfig: InitConfig = {
  path: resolve('project'),
  hasTsConfig: false,
  dbDirPath: resolve('project', 'src', 'db'),
  projectName: 'project',
  runner: 'tsx',
  esm: true,
  validation: 'no',
};
