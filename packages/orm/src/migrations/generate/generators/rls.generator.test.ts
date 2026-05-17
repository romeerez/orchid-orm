import { useGeneratorsTestUtils } from './generators.test-utils';
import { colors } from 'pqb/internal';
import { defineRls } from '../../../orm';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red } = colors;

describe('rls', () => {
  const { arrange, act, assert, BaseTable } = useGeneratorsTestUtils();

  it('should enable rls when table rls is declared as enabled', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            enable: true,
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.enableRls('table');
});
`);

    assert.report(`${green('+ enable rls')} table`);
  });

  it('should disable rls when it is enabled in db and omitted in table rls declaration', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
        }));
        await db.enableRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({});
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.disableRls('table');
});
`);

    assert.report(`${red('- enable rls')} table`);
  });

  it('should force rls when table rls is declared as forced', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
        }));
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({
            force: true,
          });
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.forceRls('table');
});
`);

    assert.report(`${green('+ force rls')} table`);
  });

  it('should no-force rls when it is forced in db and omitted in table rls declaration', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('table', (t) => ({
          id: t.identity().primaryKey(),
        }));
        await db.forceRls('table');
      },
      tables: [
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            id: t.identity().primaryKey(),
          }));
          rls = defineRls({});
        },
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.noForceRls('table');
});
`);

    assert.report(`${red('- force rls')} table`);
  });
});
