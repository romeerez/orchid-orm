import { useGeneratorsTestUtils } from './generators.test-utils';
import { DbMigration, colors } from 'rake-db';
import { DefaultColumnTypes, DefaultSchemaConfig } from 'pqb';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('enums', () => {
  const { arrange, act, assert, table } = useGeneratorsTestUtils();

  it('should be able to change enum column to a text column without recreating it', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('numbers', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          numBers: t.enum('numbers'),
        }));
      },
      tables: [
        table((t) => ({
          numBers: t.text(),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    numBers: t.change(t.enum('public.numbers'), t.text()),
  }));
});

change(async (db) => {
  await db.dropEnum('public.numbers', ['one', 'two', 'three']);
});
`);
  });

  it('should not be dropped when ignored', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');
        await db.createEnum('schema.numbers', ['one', 'two', 'three']);
        await db.createEnum('strings', ['foo', 'bar']);
      },
      dbOptions: {
        generatorIgnore: {
          schemas: ['schema'],
          enums: ['strings'],
        },
      },
    });

    await act();

    assert.report('No changes were detected');
  });

  it('should create enum when creating a table', async () => {
    await arrange({
      tables: [
        table(
          (t) => ({
            iD: t.identity().primaryKey(),
            numBers: t.enum('numbers', ['one', 'two', 'three']),
          }),
          undefined,
          { noPrimaryKey: false },
        ),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createEnum('public.numbers', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.createTable('table', (t) => ({
    iD: t.identity().primaryKey(),
    numBers: t.enum('numbers'),
  }));
});
`);

    assert.report(`${green('+ create enum')} numbers: (one, two, three)
${green('+ create table')} table (2 columns)`);
  });

  it('should drop unused enum', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('numbers', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          numBers: t.enum('numbers'),
        }));
      },
      tables: [table()],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    numBers: t.drop(t.enum('public.numbers')),
  }));
});

change(async (db) => {
  await db.dropEnum('public.numbers', ['one', 'two', 'three']);
});
`);

    assert.report(`${red('- drop enum')} numbers: (one, two, three)
${yellow('~ change table')} table:
  ${red('- drop column')} numBers public.numbers`);
  });

  it('should change enum schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createEnum('numbers', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          numBers: t.enum('numbers'),
        }));
      },
      tables: [
        table((t) => ({
          numBers: t.enum('schema.numbers', ['one', 'two', 'three']),
        })),
      ],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeTypeSchema('numbers', 'public', 'schema');
});
`);

    assert.report(
      `${yellow('~ change schema of type')} numbers ${yellow(
        '=>',
      )} schema.numbers`,
    );
  });

  it('should drop the old and create a new enum after prompt', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('from', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.enum('from'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.enum('to', ['one', 'two', 'three']),
        })),
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createEnum('public.to', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.enum('public.from'), t.enum('public.to')),
  }));
});

change(async (db) => {
  await db.dropEnum('public.from', ['one', 'two', 'three']);
});
`);

    assert.report(`${green('+ create enum')} to: (one, two, three)
${red('- drop enum')} from: (one, two, three)
${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.enum('public.from')
      ${yellow('to')}: t.enum('public.to')`);
  });

  it('should rename enum after prompt', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('from', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.enum('from'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.enum('to', ['one', 'two', 'three']),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameType('from', 'to');
});
`);

    assert.report(`${yellow('~ rename type')} from ${yellow('=>')} to`);
  });

  it('should rename and change enum', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('from', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.enum('from'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.enum('to', ['one', 'two', 'three', 'four']),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameType('from', 'to');
});

change(async (db) => {
  await db.addEnumValues('public.to', ['four']);
});
`);

    assert.report(
      `${yellow('~ rename type')} from ${yellow('=>')} to`,
      `${green('+ add values to enum')} to: four`,
    );
  });

  it('should rename schema without touching enum', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');

        await db.createEnum('from.enum', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.enum('from.enum'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.enum('to.enum', ['one', 'two', 'three']),
        })),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
`);

    assert.report(`${yellow('~ rename schema')} from ${yellow('=>')} to`);
  });

  describe('recreating and renaming both schema and enum', () => {
    const arrangeData = () => ({
      async prepareDb(
        db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>,
      ) {
        await db.createSchema('fromSchema');

        await db.createEnum('fromSchema.fromEnum', ['one', 'two', 'three']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          colUmn: t.enum('fromSchema.fromEnum'),
        }));
      },
      tables: [
        table((t) => ({
          colUmn: t.enum('toSchema.toEnum', ['one', 'two', 'three']),
        })),
      ],
    });

    it('should recreate schema and enum', async () => {
      await arrange({
        ...arrangeData(),
        selects: [0, 0],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('toSchema');
});

change(async (db) => {
  await db.createEnum('toSchema.toEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.enum('fromSchema.fromEnum'), t.enum('toSchema.toEnum')),
  }));
});

change(async (db) => {
  await db.dropEnum('fromSchema.fromEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.dropSchema('fromSchema');
});
`);

      assert.report(`${green('+ create schema')} toSchema
${red('- drop schema')} fromSchema
${green('+ create enum')} toSchema.toEnum: (one, two, three)
${red('- drop enum')} fromSchema.fromEnum: (one, two, three)
${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.enum('fromSchema.fromEnum')
      ${yellow('to')}: t.enum('toSchema.toEnum')`);
    });

    it('should recreate schema and rename enum', async () => {
      await arrange({
        ...arrangeData(),
        selects: [0, 1],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createSchema('toSchema');
});

change(async (db) => {
  await db.renameType('fromSchema.fromEnum', 'toSchema.toEnum');
});

change(async (db) => {
  await db.dropSchema('fromSchema');
});
`);

      assert.report(`${green('+ create schema')} toSchema
${red('- drop schema')} fromSchema
${yellow('~ change schema and rename type')} fromSchema.fromEnum ${yellow(
        '=>',
      )} toSchema.toEnum`);
    });

    it('should rename schema and recreate enum', async () => {
      await arrange({
        ...arrangeData(),
        selects: [1, 0],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('fromSchema', 'toSchema');
});

change(async (db) => {
  await db.createEnum('toSchema.toEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    colUmn: t.change(t.enum('toSchema.fromEnum'), t.enum('toSchema.toEnum')),
  }));
});

change(async (db) => {
  await db.dropEnum('toSchema.fromEnum', ['one', 'two', 'three']);
});
`);

      assert.report(`${yellow('~ rename schema')} fromSchema ${yellow(
        '=>',
      )} toSchema
${green('+ create enum')} toSchema.toEnum: (one, two, three)
${red('- drop enum')} toSchema.fromEnum: (one, two, three)
${yellow('~ change table')} table:
  ${yellow('~ change column')} colUmn:
    ${yellow('from')}: t.enum('toSchema.fromEnum')
      ${yellow('to')}: t.enum('toSchema.toEnum')`);
    });

    it('should rename schema and enum', async () => {
      await arrange({
        ...arrangeData(),
        selects: [1, 1],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameSchema('fromSchema', 'toSchema');
});

change(async (db) => {
  await db.renameType('toSchema.fromEnum', 'toSchema.toEnum');
});
`);

      assert.report(`${yellow('~ rename schema')} fromSchema ${yellow(
        '=>',
      )} toSchema
${yellow('~ rename type')} toSchema.fromEnum ${yellow('=>')} toSchema.toEnum`);
    });
  });

  describe('enum values', () => {
    const tableWithEnum = (values: [string, ...string[]]) =>
      table((t) => ({
        numBers: t.enum('numbers', values),
      }));

    const prepareDb =
      (values: [string, ...string[]]) =>
      async (db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>) => {
        await db.createEnum('numbers', values);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          numBers: t.enum('numbers'),
        }));
      };

    it('should add values to enum', async () => {
      await arrange({
        prepareDb: prepareDb(['one']),
        tables: [tableWithEnum(['one', 'two', 'three'])],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.addEnumValues('public.numbers', ['two', 'three']);
});
`);

      assert.report(`${green('+ add values to enum')} numbers: two, three`);
    });

    it('should drop values from enum', async () => {
      await arrange({
        prepareDb: prepareDb(['one', 'two', 'three']),
        tables: [tableWithEnum(['one'])],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropEnumValues('public.numbers', ['two', 'three']);
});
`);

      assert.report(`${red('- remove values from enum')} numbers: two, three`);
    });

    it('should recreate enum when values do not match', async () => {
      await arrange({
        prepareDb: prepareDb(['one', 'two']),
        tables: [tableWithEnum(['three', 'four'])],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.changeEnumValues('public.numbers', ['one', 'two'], ['three', 'four']);
});
`);

      assert.report(
        `${red('- remove values from enum')} numbers: one, two
${green('+ add values to enum')} numbers: three, four`,
      );
    });

    it('should do nothing if enum was not changed', async () => {
      await arrange({
        prepareDb: prepareDb(['one', 'two', 'three']),
        tables: [tableWithEnum(['one', 'two', 'three'])],
      });

      await act();

      assert.migration();
    });
  });

  it('should recognize nullable column', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createEnum('x', ['one']);

        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          col: t.enum('x').nullable(),
        }));
      },
      tables: [
        table((t) => ({
          col: t.enum('x', ['one']).nullable(),
        })),
      ],
    });

    await act();

    assert.migration();
  });
});
