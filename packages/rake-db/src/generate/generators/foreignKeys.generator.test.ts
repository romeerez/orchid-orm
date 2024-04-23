import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, table, makeStructure } = generatorsTestUtils;

describe('primaryKey', () => {
  beforeEach(jest.clearAllMocks);

  it.only('should create a column foreign key', async () => {
    arrange({
      tables: [
        table((t) => ({
          someId: t.integer().foreignKey('some', 'id'),
        })),
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'table',
            columns: [dbStructureMockFactory.intColumn({ name: 'someId' })],
          }),
        ],
      }),
    });

    await act();

    // assert.migration(`import { change } from '../src/dbScript';
    // `);
  });

  it.todo('should drop a column foreign key');

  it.todo('should rename a column foreign key');

  it.todo('should not be recreated when a column foreign key is identical');

  it.todo('should recreate a column foreign key with different options');

  it.todo('should create a composite foreign key');

  it.todo('should not recreate composite foreign key when it is identical');

  it.todo('should recreate composite foreign key');

  it.todo('should rename a composite foreign key');

  it.todo('should be added together with a column');

  it.todo('should be dropped together with a column');

  it.todo('should be added in a column change');

  it.todo('should not be recreated when a column is renamed');
});
