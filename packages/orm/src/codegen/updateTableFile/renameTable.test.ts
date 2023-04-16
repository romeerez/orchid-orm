import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import { resolve } from 'path';
import fs from 'fs/promises';
import { pathToLog } from 'orchid-core';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const baseTablePath = resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const log = jest.fn();
const params = {
  tablePath,
  logger: { ...console, log },
  baseTable: {
    filePath: baseTablePath,
    name: baseTableName,
  },
};

const path = tablePath('fooBar');
const testWrittenOnly = makeTestWritten(path);
const testWritten = (content: string) => {
  testWrittenOnly(content);
  expect(log).toBeCalledWith(`Updated ${pathToLog(path)}`);
};

describe('renameTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should change `table` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  readonly table = 'foo_bar';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: ast.renameTable,
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  readonly table = 'bip_bop';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should change `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  schema = 'one';
  readonly table = 'foo_bar';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.renameTable,
        fromSchema: 'one',
        toSchema: 'two',
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  schema = 'two';
  readonly table = 'bip_bop';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should remove `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  schema = 'one';
  readonly table = 'foo_bar';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.renameTable,
        fromSchema: 'one',
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  readonly table = 'bip_bop';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should add `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  readonly table = 'foo_bar';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: {
        ...ast.renameTable,
        toSchema: 'schema',
      },
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class FooBarTable extends BaseTable {
  schema = 'schema';
  readonly table = 'bip_bop';
  columns = this.setColumns((t) => ({}));
}`);
  });
});
