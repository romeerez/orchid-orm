import { updateTableFile } from './updateTableFile';
import { asMock, ast, makeTestWritten, tablePath } from '../testUtils';
import path from 'path';
import fs from 'fs/promises';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const baseTablePath = path.resolve('baseTable.ts');
const baseTableName = 'BaseTable';
const params = { baseTablePath, baseTableName, tablePath };

const testWritten = makeTestWritten(tablePath('some'));

describe('renameTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should change `table` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  table = 'some';
  columns = this.setColumns((t) => ({}));
}`);

    await updateTableFile({
      ...params,
      ast: ast.renameTable,
    });

    testWritten(`import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  table = 'another';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should change `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  schema = 'one';
  table = 'some';
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

export class SomeTable extends BaseTable {
  schema = 'two';
  table = 'another';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should remove `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  schema = 'one';
  table = 'some';
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

export class SomeTable extends BaseTable {
  table = 'another';
  columns = this.setColumns((t) => ({}));
}`);
  });

  it('should add `schema` property', async () => {
    asMock(fs.readFile)
      .mockResolvedValue(`import { BaseTable } from '../baseTable';

export class SomeTable extends BaseTable {
  table = 'some';
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

export class SomeTable extends BaseTable {
  schema = 'schema';
  table = 'another';
  columns = this.setColumns((t) => ({}));
}`);
  });
});
