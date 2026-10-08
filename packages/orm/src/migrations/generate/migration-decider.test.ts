import {
  defineTable,
  useGeneratorsTestUtils,
} from './generators/generators.test-utils';
import { interactiveDecider } from './migration-decider';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { createOrRename } = interactiveDecider;
// candidates are taken when asked, because generators change the list after
const createOrRenameIds = jest.fn();
jest
  .spyOn(interactiveDecider, 'createOrRename')
  .mockImplementation((question) => {
    const { kind, target, candidates, candidateSource } = question;
    createOrRenameIds({
      kind,
      target,
      sources: candidates.map(candidateSource),
    });
    return createOrRename(question);
  });
const addOrRenameEnumValue = jest.spyOn(
  interactiveDecider,
  'addOrRenameEnumValue',
);
const recreateColumn = jest.spyOn(interactiveDecider, 'recreateColumn');

describe('migration decider', () => {
  const { arrange, act } = useGeneratorsTestUtils();

  // generators rename the database structure in place, while questions must
  // keep referring to the items as they are named in the database
  it('should ask about renamed schema, table, and column by their database names', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('legacy');
        await db.createTable('legacy.users', { noPrimaryKey: true }, (t) => ({
          oldCol: t.text(),
        }));
      },
      tables: [
        defineTable(
          'members',
          { schema: 'app', nameInDb: 'members', noPrimaryKey: true },
          (t) => ({
            newCol: t.text(),
          }),
        ),
      ],
      selects: [1, 1, 1],
    });

    await act();

    expect(createOrRenameIds.mock.calls.map(([ids]) => ids)).toEqual([
      {
        kind: 'schema',
        target: { name: 'app' },
        sources: [{ name: 'legacy' }],
      },
      {
        kind: 'table',
        target: { schema: 'app', name: 'members' },
        sources: [{ schema: 'legacy', name: 'users' }],
      },
      {
        kind: 'column',
        target: { schema: 'app', table: 'members', name: 'new_col' },
        sources: [{ schema: 'legacy', table: 'users', name: 'old_col' }],
      },
    ]);
  });

  it('should ask about a value of an enum in a renamed schema by its database name', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('legacy');
        await db.createEnum('legacy.mood', ['ok', 'sad']);
        await db.createTable('items', { noPrimaryKey: true }, (t) => ({
          mood: t.enum('legacy.mood'),
        }));
      },
      tables: [
        defineTable('items', { noPrimaryKey: true }, (t) => ({
          mood: t.enum('app.mood', ['ok', 'happy']),
        })),
      ],
      selects: [1, 1],
    });

    await act();

    expect(
      addOrRenameEnumValue.mock.calls.map(([{ source, target }]) => ({
        source,
        target,
      })),
    ).toEqual([
      {
        source: { schema: 'legacy', name: 'mood' },
        target: { schema: 'app', name: 'mood' },
      },
    ]);
  });

  it('should ask about recreating a column of a renamed table by its database name', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('legacy');
        await db.createTable('legacy.users', { noPrimaryKey: true }, (t) => ({
          someCol: t.integer(),
        }));
      },
      tables: [
        defineTable(
          'members',
          { schema: 'app', nameInDb: 'members', noPrimaryKey: true },
          (t) => ({
            someCol: t.array(t.integer()),
          }),
        ),
      ],
      selects: [1, 1, 0],
    });

    await act();

    expect(
      recreateColumn.mock.calls.map(([{ source, target }]) => ({
        source,
        target,
      })),
    ).toEqual([
      {
        source: { schema: 'legacy', table: 'users', name: 'some_col' },
        target: { schema: 'app', table: 'members', name: 'some_col' },
      },
    ]);
  });

  it('should ask about recreating an array column by its physical name', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('items', { noPrimaryKey: true }, (t) => ({
          someCol: t.array(t.integer()),
        }));
      },
      tables: [
        defineTable('items', { noPrimaryKey: true }, (t) => ({
          someCol: t.array(t.uuid()),
        })),
      ],
      selects: [1],
    });

    await act();

    expect(
      recreateColumn.mock.calls.map(([{ source, target }]) => ({
        source,
        target,
      })),
    ).toEqual([
      {
        source: { schema: 'public', table: 'items', name: 'some_col' },
        target: { schema: 'public', table: 'items', name: 'some_col' },
      },
    ]);
  });
});
