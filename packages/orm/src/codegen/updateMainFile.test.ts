import { updateMainFile } from './updateMainFile';
import * as path from 'path';
import * as fs from 'fs/promises';
import { asMock, ast, makeTestWritten, tablePath } from './testUtils';
import { RakeDbAst } from 'rake-db';
import { pathToLog } from 'orchid-core';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

const mainFilePath = path.resolve('db.ts');
const testWritten = makeTestWritten(mainFilePath);
const options = { databaseURL: 'url' };

const log = jest.fn();
const logger = {
  ...console,
  log,
};

const run = (ast: RakeDbAst) =>
  updateMainFile(mainFilePath, tablePath, ast, options, logger);

describe('updateMainFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    log.mockClear();
  });

  describe('add table', () => {
    it('should create file if not exist and add a table', async () => {
      asMock(fs.readFile).mockRejectedValue(
        Object.assign(new Error(), { code: 'ENOENT' }),
      );

      await run(ast.addTable);

      expect(asMock(fs.mkdir)).toBeCalledWith(path.dirname(mainFilePath), {
        recursive: true,
      });

      testWritten(`import { orchidORM } from 'orchid-orm';
import { SomeTable } from './tables/some.table';

export const db = orchidORM(
  {
    databaseURL: 'url',
  },
  {
    some: SomeTable,
  }
);
`);

      expect(log).toBeCalledWith(`Created ${pathToLog(mainFilePath)}`);
    });

    it('should add table', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {});
`);

      await run(ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { SomeTable } from './tables/some.table';

export const db = orchidORM({}, {
  some: SomeTable,
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should handle import as', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM as custom } from 'orchid-orm';

export const db = custom({}, {});
`);

      await run(ast.addTable);

      testWritten(`
import { orchidORM as custom } from 'orchid-orm';
import { SomeTable } from './tables/some.table';

export const db = custom({}, {
  some: SomeTable,
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should handle object list with elements', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Other } from './tables/other';

export const db = orchidORM({}, {
  other: Other,
});
`);

      await run(ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { Other } from './tables/other';
import { SomeTable } from './tables/some.table';

export const db = orchidORM({}, {
  other: Other,
  some: SomeTable,
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should handle object list without ending coma', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { MyTable } from './tables/my.table';

export const db = orchidORM({}, {
  my: MyTable,
});
`);

      await run(ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { MyTable } from './tables/my.table';
import { SomeTable } from './tables/some.table';

export const db = orchidORM({}, {
  my: MyTable,
  some: SomeTable,
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should not add table if it is already added', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { SomeTable } from './tables/some.table';

export const db = orchidORM({}, {
  some: SomeTable
});
`);

      await run(ast.addTable);

      expect(fs.writeFile).not.toBeCalled();
      expect(log).not.toBeCalled();
    });
  });

  describe('drop table', () => {
    it('should remove table', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { SomeTable } from './tables/some.table';

export const db = orchidORM({}, {
  some: SomeTable,
});
`);

      await run(ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should remove aliased import', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { SomeTable as koko } from './tables/some.table';

export const db = orchidORM({}, {
  koko: koko,
});
`);

      await run(ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should remove short form of key and value', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { SomeTable as koko } from './tables/some.table';

export const db = orchidORM({}, {
  koko,
});
`);

      await run(ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should not remove other tables', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { One } from './tables/one';
import { SomeTable } from './tables/some.table';
import { Two } from './tables/two';

export const db = orchidORM({}, {
  one,
  some: SomeTable,
  two,
});
`);

      await run(ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { One } from './tables/one';
import { Two } from './tables/two';

export const db = orchidORM({}, {
  one,
  two,
});
`);

      expect(log).toBeCalledWith(`Updated ${pathToLog(mainFilePath)}`);
    });

    it('should not insert table if table with same key exists, disregarding the import path', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { X } from './x';

export const db = orchidORM({}, {
  some: X,
});
`);

      await run(ast.addTable);

      expect(fs.writeFile).not.toBeCalled();
      expect(log).not.toBeCalled();
    });
  });
});
