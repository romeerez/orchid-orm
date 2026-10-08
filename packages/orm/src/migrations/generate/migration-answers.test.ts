import fs from 'node:fs/promises';
import { promptSelect, RakeDbError } from 'rake-db';
import {
  defineTable,
  GeneratorTestDb,
  useGeneratorsTestUtils,
} from './generators/generators.test-utils';
import { formatPath, parseGenerateArgs } from './migration-answers';

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

describe('migration answers', () => {
  const { arrange, act, assert } = useGeneratorsTestUtils();

  describe('parseGenerateArgs', () => {
    it('should separate flags from the migration name and `up`', () => {
      expect(
        parseGenerateArgs([
          'name',
          '--non-interactive',
          '--create',
          'table:public.one',
          '--transaction',
          'single',
          'up',
          '--rename=column:public.one.a=public.one.b',
          '--transaction=single',
        ]),
      ).toEqual({
        positional: ['name', 'up'],
        nonInteractive: true,
        answers: [
          {
            flag: '--create table:public.one',
            action: 'create',
            kind: 'table',
            target: ['public', 'one'],
          },
          {
            flag: '--rename column:public.one.a=public.one.b',
            action: 'rename',
            kind: 'column',
            source: ['public', 'one', 'a'],
            target: ['public', 'one', 'b'],
          },
        ],
      });
    });

    it('should read the names that formatPath quotes', () => {
      const path = ['my.schema', 'a"b', ''];
      const formatted = formatPath(path);

      expect(formatted).toBe('"my.schema"."a""b".""');
      expect(
        parseGenerateArgs(['--create', `enum-value:${formatted}`]).answers[0]
          .target,
      ).toEqual(path);
    });

    it.each([
      [['--non-interactive=true'], 'Unknown flag --non-interactive=true'],
      [['--renmae', 'schema:a=b'], 'Unknown flag --renmae'],
      [['--rename'], '--rename requires a value'],
      [
        ['--create', 'thing:a'],
        'Invalid --create thing:a: expected one of schema, role, enum, table, column, enum-value followed by a colon',
      ],
      [
        ['--recreate', 'table:public.a=public.b'],
        'Invalid --recreate table:public.a=public.b: only a column can be recreated',
      ],
      [
        ['--create', 'table:a'],
        'Invalid --create table:a: table must be given by 2 dot-separated names',
      ],
      [
        ['--rename', 'schema:a'],
        'Invalid --rename schema:a: expected the old name and the new name separated by "="',
      ],
      [
        ['--create', 'schema:a=b'],
        'Invalid --create schema:a=b: unexpected text after the name',
      ],
      [
        ['--create', 'schema:"a'],
        'Invalid --create schema:"a: unterminated quoted name',
      ],
      [
        ['--create', 'table:public.'],
        'Invalid --create table:public.: expected a name',
      ],
      [
        ['--create', 'table:public.a', '--rename', 'table:public.b=public.a'],
        '--rename table:public.b=public.a conflicts with --create table:public.a',
      ],
      [
        ['--rename', 'schema:a=b', '--rename', 'schema:a=c'],
        '--rename schema:a=c conflicts with --rename schema:a=b',
      ],
    ])('should reject %j', (args, message) => {
      expect(() => parseGenerateArgs(args)).toThrow(new RakeDbError(message));
    });
  });

  describe('generate', () => {
    const prepareLegacyDb = async (db: GeneratorTestDb) => {
      await db.createSchema('legacy');
      await db.createTable('legacy.users', { noPrimaryKey: true }, (t) => ({
        oldCol: t.text(),
      }));
    };

    const membersTable = defineTable(
      'members',
      { schema: 'app', nameInDb: 'members', noPrimaryKey: true },
      (t) => ({
        newCol: t.text(),
      }),
    );

    const renamedMigration = `import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('legacy', 'app');
});

change(async (db) => {
  await db.renameTable('app.users', 'app.members');
});

change(async (db) => {
  await db.changeTable('app.members', (t) => ({
    oldCol: t.rename('newCol'),
  }));
});
`;

    it('should report the questions with the flags to answer them and not write the migration', async () => {
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await expect(act(['--non-interactive'])).rejects.toThrow(
        new RakeDbError(`Cannot generate the migration.

Run the command again with one of the suggested flags for each question, keeping the answer flags given before:

Create or rename schema app?
  --create schema:app
  --rename schema:legacy=app

Create or rename table app.members?
  --create table:app.members
  --rename table:legacy.users=app.members

More questions may come up after these are answered.`),
      );

      expect(promptSelect).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should not ask when stdin is not a TTY', async () => {
      process.stdin.isTTY = false;
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await expect(act()).rejects.toThrow('Create or rename schema app?');

      expect(promptSelect).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should take the answers by the database names before any changes', async () => {
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await act([
        '--non-interactive',
        '--rename',
        'schema:legacy=app',
        '--rename',
        'table:legacy.users=app.members',
        '--rename',
        'column:legacy.users.old_col=app.members.new_col',
      ]);

      assert.migration(renamedMigration);
    });

    it('should ask only the questions without answers in a terminal', async () => {
      await arrange({
        prepareDb: prepareLegacyDb,
        tables: [membersTable],
        selects: [1, 1],
      });

      await act(['--rename', 'schema:legacy=app']);

      expect(promptSelect).toHaveBeenCalledTimes(2);
      assert.migration(renamedMigration);
    });

    it('should create items by the answers', async () => {
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await act([
        '--non-interactive',
        '--create',
        'schema:app',
        '--create',
        'table:app.members',
      ]);

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('app');

  await db.dropTable(
    'legacy.users',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      oldCol: t.text(),
    }),
  );
});

change(async (db) => {
  await db.dropSchema('legacy');

  await db.createTable(
    'app.members',
    {
      noPrimaryKey: true,
    },
    (t) => ({
      newCol: t.text(),
    }),
  );
});
`);
    });

    it('should rename a role by the answer', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createRole('answers_old_role');
        },
        dbOptions: {
          roles: [{ name: 'answers_new_role' }],
        },
      });

      await act([
        '--non-interactive',
        '--rename',
        'role:answers_old_role=answers_new_role',
      ]);

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameRole('answers_old_role', 'answers_new_role');
});
`);
    });

    it('should rename an enum by the answer', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createEnum('old_enum', ['one']);
          await db.createTable('items', { noPrimaryKey: true }, (t) => ({
            kind: t.enum('old_enum'),
          }));
        },
        tables: [
          defineTable('items', { noPrimaryKey: true }, (t) => ({
            kind: t.enum('new_enum', ['one']),
          })),
        ],
      });

      await act([
        '--non-interactive',
        '--rename',
        'enum:public.old_enum=public.new_enum',
      ]);

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameType('old_enum', 'new_enum');
});
`);
    });

    it('should rename and add enum values by the answers, including an empty value', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createEnum('mood', ['', 'sad']);
          await db.createTable('items', { noPrimaryKey: true }, (t) => ({
            mood: t.enum('mood'),
          }));
        },
        tables: [
          defineTable('items', { noPrimaryKey: true }, (t) => ({
            mood: t.enum('mood', ['ok', 'happy']),
          })),
        ],
      });

      await expect(act(['--non-interactive'])).rejects.toThrow(
        `Add or rename enum value public.mood.ok?
  --create enum-value:public.mood.ok
  --rename 'enum-value:public.mood.""=public.mood.ok'
  --rename enum-value:public.mood.sad=public.mood.ok`,
      );

      await act([
        '--non-interactive',
        '--rename',
        'enum-value:public.mood.""=public.mood.ok',
        '--create',
        'enum-value:public.mood.happy',
      ]);

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameEnumValues('mood', { '': 'ok' });

  await db.changeEnumValues('mood', ['ok', 'sad'], ['ok', 'happy']);
});
`);
    });

    it('should recreate a column by the answer', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('items', { noPrimaryKey: true }, (t) => ({
            someCol: t.integer(),
          }));
        },
        tables: [
          defineTable('items', { noPrimaryKey: true }, (t) => ({
            someCol: t.uuid(),
          })),
        ],
      });

      await expect(act(['--non-interactive'])).rejects.toThrow(
        `Cannot cast column public.items.some_col from int4 to uuid. Recreate it (existing data will be lost), or write the migration manually?
  --recreate column:public.items.some_col=public.items.some_col`,
      );

      await act([
        '--non-interactive',
        '--recreate',
        'column:public.items.some_col=public.items.some_col',
      ]);

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('items', (t) => ({
    ...t.drop(t.name('some_col').integer()),
    ...t.add(t.name('some_col').uuid()),
  }));
});
`);
    });

    it.each([
      [
        'archive.old',
        `  await db.renameTable('archive.old', 'new');

  await db.dropTable(
    'old',`,
      ],
      [
        'public.old',
        `  await db.renameTable('old', 'new');

  await db.dropTable(
    'archive.old',`,
      ],
    ])(
      'should rename %s given by the answer among tables with the same name in different schemas',
      async (source, renameAndDrop) => {
        await arrange({
          async prepareDb(db) {
            await db.createSchema('archive');
            await db.createTable('archive.old', { noPrimaryKey: true });
            await db.createTable('old', { noPrimaryKey: true });
          },
          tables: [
            defineTable(
              'new',
              { noPrimaryKey: true, nameInDb: 'new' },
              () => ({}),
            ),
          ],
        });

        await act([
          '--non-interactive',
          '--rename',
          `table:${source}=public.new`,
        ]);

        assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
${renameAndDrop}
    {
      noPrimaryKey: true,
    },
    (t) => ({}),
  );
});

change(async (db) => {
  await db.dropSchema('archive');
});
`);
      },
    );

    it('should not write the migration when recreating another column than asked', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('items', { noPrimaryKey: true }, (t) => ({
            someCol: t.integer(),
          }));
        },
        tables: [
          defineTable('items', { noPrimaryKey: true }, (t) => ({
            someCol: t.uuid(),
          })),
        ],
      });

      await expect(
        act([
          '--non-interactive',
          '--recreate',
          'column:public.wrong.some_col=public.items.some_col',
        ]),
      ).rejects.toThrow(
        new RakeDbError(`Cannot generate the migration.

--recreate column:public.wrong.some_col=public.items.some_col: the column to recreate is public.items.some_col`),
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should report an answer renaming an item that cannot be renamed', async () => {
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await expect(
        act([
          '--non-interactive',
          '--rename',
          'schema:legacy=app',
          '--rename',
          'table:legacy.people=app.members',
        ]),
      ).rejects.toThrow(
        new RakeDbError(`Cannot generate the migration.

--rename table:legacy.people=app.members: legacy.people is not among the tables that can be renamed to app.members: legacy.users`),
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should accept creating an item that is no longer asked about after a rename', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createSchema('old');
        },
        tables: ['b', 'c'].map((schema) =>
          defineTable('one', { schema, noPrimaryKey: true }, () => ({})),
        ),
      });

      await expect(act(['--non-interactive'])).rejects.toThrow(
        `Create or rename schema b?
  --create schema:b
  --rename schema:old=b

Create or rename schema c?
  --create schema:c
  --rename schema:old=c`,
      );

      await act([
        '--non-interactive',
        '--rename',
        'schema:old=b',
        '--create',
        'schema:c',
      ]);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should report renames that do not match any question', async () => {
      await arrange({ prepareDb: prepareLegacyDb, tables: [membersTable] });

      await expect(
        act([
          '--non-interactive',
          '--rename',
          'schema:legacy=app',
          '--rename',
          'table:legacy.users=app.members',
          '--rename',
          'column:legacy.users.old_col=app.members.new_col',
          '--rename',
          'table:public.one=public.other',
        ]),
      ).rejects.toThrow(
        new RakeDbError(`Cannot generate the migration.

These renames do not match any question:
--rename table:public.one=public.other`),
      );

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});
