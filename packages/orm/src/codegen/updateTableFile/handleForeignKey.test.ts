import { handleForeignKey } from './handleForeignKey';
import { updateTableFileParams } from '../testUtils';

const params = Object.assign(updateTableFileParams, {
  getTable: updateTableFileParams.getTable,
  relations: {},
  tableName: 'one',
  columns: ['oneId'],
  foreignTableName: 'two',
  foreignColumns: ['twoId'],
});

describe('handleForeignKey', () => {
  beforeEach(() => {
    params.relations = {};
    params.clearTables();
  });

  it('should add belongsTo and hasMany relations', async () => {
    params.tables.one = {
      key: 'one',
      name: 'OneTable',
      path: params.tablePath('one'),
    };
    params.tables.two = {
      key: 'two',
      name: 'TwoTable',
      path: params.tablePath('two'),
    };

    await handleForeignKey(params);

    expect(params.relations).toEqual({
      one: {
        path: params.tables.one.path,
        relations: [
          {
            kind: 'belongsTo',
            columns: ['oneId'],
            className: 'TwoTable',
            path: params.tables.two.path,
            foreignColumns: ['twoId'],
          },
        ],
      },
      two: {
        path: params.tables.two.path,
        relations: [
          {
            kind: 'hasMany',
            columns: ['twoId'],
            className: 'OneTable',
            path: params.tables.one.path,
            foreignColumns: ['oneId'],
          },
        ],
      },
    });
  });

  it('should skip belongsTo relation if skipBelongsTo provided', async () => {
    params.tables.one = {
      key: 'one',
      name: 'OneTable',
      path: params.tablePath('one'),
    };
    params.tables.two = {
      key: 'two',
      name: 'TwoTable',
      path: params.tablePath('two'),
    };

    await handleForeignKey({ ...params, skipBelongsTo: true });

    expect(params.relations).toEqual({
      two: {
        path: params.tables.two.path,
        relations: [
          {
            kind: 'hasMany',
            columns: ['twoId'],
            className: 'OneTable',
            path: params.tables.one.path,
            foreignColumns: ['oneId'],
          },
        ],
      },
    });
  });
});
