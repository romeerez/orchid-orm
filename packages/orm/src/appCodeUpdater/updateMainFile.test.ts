import { updateMainFile } from './updateMainFile';
import * as path from 'path';
import * as fs from 'fs/promises';
import { asMock, ast, makeTestWritten, tablePath } from './testUtils';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const mainFilePath = path.resolve('db.ts');
const testWritten = makeTestWritten(mainFilePath);

describe('updateMainFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should throw when file is not found', async () => {
    asMock(fs.readFile).mockRejectedValue(new Error());

    await expect(() =>
      updateMainFile(mainFilePath, tablePath, ast.addTable),
    ).rejects.toThrow();
  });

  describe('add table', () => {
    it('should add table', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {});
`);

      await updateMainFile(mainFilePath, tablePath, ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { Table } from './tables/table';

export const db = orchidORM({}, {
  table: Table,
});
`);
    });

    it('should handle import as', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM as custom } from 'orchid-orm';

export const db = custom({}, {});
`);

      await updateMainFile(mainFilePath, tablePath, ast.addTable);

      testWritten(`
import { orchidORM as custom } from 'orchid-orm';
import { Table } from './tables/table';

export const db = custom({}, {
  table: Table,
});
`);
    });

    it('should handle object list with elements', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Some } from './tables/some';

export const db = orchidORM({}, {
  some: Some,
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { Some } from './tables/some';
import { Table } from './tables/table';

export const db = orchidORM({}, {
  some: Some,
  table: Table,
});
`);
    });

    it('should handle object list without ending coma', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Some } from './tables/some';

export const db = orchidORM({}, {
  some: Some
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.addTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { Some } from './tables/some';
import { Table } from './tables/table';

export const db = orchidORM({}, {
  some: Some,
  table: Table,
});
`);
    });
  });

  describe('drop table', () => {
    it('should remove table', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Table } from './tables/table';

export const db = orchidORM({}, {
  table: Table,
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);
    });

    it('should remove aliased import', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Table as koko } from './tables/table';

export const db = orchidORM({}, {
  koko: koko,
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);
    });

    it('should remove short form of key and value', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { Table as koko } from './tables/table';

export const db = orchidORM({}, {
  koko,
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';

export const db = orchidORM({}, {
});
`);
    });

    it('should not remove other tables', async () => {
      asMock(fs.readFile).mockResolvedValue(`
import { orchidORM } from 'orchid-orm';
import { One } from './tables/one';
import { Table } from './tables/table';
import { Two } from './tables/two';

export const db = orchidORM({}, {
  one,
  table: Table,
  two,
});
`);

      await updateMainFile(mainFilePath, tablePath, ast.dropTable);

      testWritten(`
import { orchidORM } from 'orchid-orm';
import { One } from './tables/one';
import { Two } from './tables/two';

export const db = orchidORM({}, {
  one,
  two,
});
`);
    });
  });
});
