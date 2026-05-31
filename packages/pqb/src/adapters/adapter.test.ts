import {
  Adapter,
  AdapterClass,
  HackySavepointState,
  TransactionAdapterClass,
} from './adapter';
import { OrchidOrmInternalError, QueryError } from '../query/errors';
import { allDriverAdapters, testDb, testDbOptions } from 'test-utils';

describe('adapter runtime abstractions', () => {
  afterEach(() => jest.clearAllMocks());

  Object.entries(allDriverAdapters).forEach(([name, driverAdapter]) => {
    describe(name, () => {
      const counterTable = `"adapter_test_counter"`;
      const getCounterValueSql = `SELECT "value" FROM ${counterTable}`;
      const incrementCounterSql = `UPDATE ${counterTable} SET "value" = "value" + 1`;
      let adapter: AdapterClass;

      beforeAll(async () => {
        adapter = new AdapterClass({
          driverAdapter,
          config: testDbOptions,
        });

        try {
          await adapter.query(
            `CREATE TABLE ${counterTable} ("value" integer NOT NULL)`,
          );
          await adapter.query(
            `INSERT INTO ${counterTable}("value") VALUES (0)`,
          );
        } finally {
          await adapter.close();
        }
      });

      beforeEach(async () => {
        adapter = new AdapterClass({
          driverAdapter,
          config: testDbOptions,
        });
      });

      afterEach(async () => {
        await adapter.close();
      });

      afterAll(async () => {
        adapter = new AdapterClass({
          driverAdapter,
          config: testDbOptions,
        });

        try {
          await adapter.query(`DROP TABLE ${counterTable}`);
        } finally {
          await adapter.close();
        }
      });

      it('runs query and can be reopened after close', async () => {
        const beforeClose = await adapter.query<{ num: number }>(
          'SELECT 1 as num',
        );

        expect(beforeClose).toMatchObject({
          rowCount: 1,
          rows: [{ num: 1 }],
          fields: [{ name: 'num' }],
        });

        await adapter.close();

        const afterClose = await adapter.query<{ num: number }>(
          'SELECT 1 as num',
        );
        expect(afterClose.rows[0].num).toBe(1);
      });

      it('does not parse specific postgres types', async () => {
        const res = await adapter.query<{
          date: string;
          timestamp: string;
          timestamptz: string;
          circle: string;
        }>(`
          SELECT
            now()::date as date,
            now()::timestamp as timestamp,
            now()::timestamptz as timestamptz,
            '((3,4),5)'::circle as circle
        `);

        expect(res.rows[0]).toEqual({
          date: expect.any(String),
          timestamp: expect.any(String),
          timestamptz: expect.any(String),
          circle: expect.any(String),
        });
      });

      it('returns arrays result shape', async () => {
        const res = await adapter.arrays<[number]>('SELECT 1 as num');

        expect(res).toMatchObject({
          rowCount: 1,
          rows: [[1]],
          fields: [{ name: 'num' }],
        });
      });

      describe('transaction', () => {
        it('executes transaction callback with TransactionAdapterClass', async () => {
          const result = await adapter.transaction(
            undefined,
            undefined,
            async (trx) => {
              expect(trx).toBeInstanceOf(TransactionAdapterClass);
              const res = await trx.query<{ one: number }>('SELECT 1 as one');
              return res.rows[0].one;
            },
          );

          expect(result).toBe(1);
        });

        it('supports transaction options string', async () => {
          const spy = jest.spyOn(adapter.driverAdapter, 'begin');

          await Promise.all([
            adapter.transaction(
              undefined,
              { level: 'REPEATABLE READ' },
              async () => {},
            ),
            adapter.transaction(
              undefined,
              { level: 'READ COMMITTED', readOnly: false, deferrable: false },
              async () => {},
            ),
            adapter.transaction(
              undefined,
              { level: 'READ UNCOMMITTED', readOnly: true, deferrable: true },
              async () => {},
            ),
          ]);

          // expect(res.rows[0].one).toBe(1);
          expect(spy.mock.calls.map((call) => call[2])).toEqual([
            'ISOLATION LEVEL REPEATABLE READ',
            'ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE',
            'ISOLATION LEVEL READ UNCOMMITTED READ ONLY DEFERRABLE',
          ]);
        });

        it('should run a nested transaction with SAVEPOINT and RELEASE SAVEPOINT', async () => {
          const beginSpy = jest.spyOn(adapter.driverAdapter, 'begin');
          const savepointSpy = jest.spyOn(
            TransactionAdapterClass.prototype,
            'savepoint',
          );
          const querySpy = jest.spyOn(adapter.driverAdapter, 'queryClient');

          const {
            rows: [{ result }],
          } = await adapter.transaction(
            testDb.internal.asyncStorage,
            undefined,
            async () =>
              await adapter.transaction(
                testDb.internal.asyncStorage,
                undefined,
                async (client) => client.query('SELECT 123 as result'),
              ),
          );

          expect(result).toBe(123);

          expect(beginSpy).toBeCalledTimes(1);
          expect(savepointSpy).toBeCalledTimes(1);
          expect(querySpy.mock.calls.map((call) => call[1])).toEqual([
            'SELECT 123 as result',
          ]);
        });

        it('should rollback a nested transaction with ROLLBACK TO SAVEPOINT', async () => {
          const beginSpy = jest.spyOn(adapter.driverAdapter, 'begin');
          const savepointSpy = jest.spyOn(
            TransactionAdapterClass.prototype,
            'savepoint',
          );
          const querySpy = jest.spyOn(adapter.driverAdapter, 'queryClient');

          await expect(() =>
            adapter.transaction(
              testDb.internal.asyncStorage,
              undefined,
              async () =>
                await adapter.transaction(
                  testDb.internal.asyncStorage,
                  undefined,
                  async () => {
                    throw new Error('error');
                  },
                ),
            ),
          ).rejects.toThrow('error');

          expect(beginSpy).toBeCalledTimes(1);
          expect(savepointSpy).toBeCalledTimes(1);
          expect(querySpy.mock.calls.map((call) => call[1])).toEqual([]);
        });

        it('sets search_path for transaction setConfig', async () => {
          const res = await adapter.transaction(
            undefined,
            { setConfig: { search_path: 'schema' } },
            async (trx) =>
              trx.query<{ search_path: string }>('SHOW search_path'),
          );

          expect(res.rows[0].search_path).toBe('schema');
        });

        it('temporarily overrides setConfig in nested transaction call', async () => {
          const getSearchPath = async (trx: Adapter) => {
            const res = await trx.query<{ search_path: string }>(
              'SHOW search_path',
            );
            return res.rows[0].search_path;
          };

          const res = await adapter.transaction(
            testDb.internal.asyncStorage,
            { setConfig: { search_path: 'public' } },
            async (trx) => {
              const before = await getSearchPath(trx);
              const nested = await trx.transaction(
                testDb.internal.asyncStorage,
                { setConfig: { search_path: 'schema' } },
                (nestedTrx) => getSearchPath(nestedTrx),
              );
              const after = await getSearchPath(trx);
              return { before, nested, after };
            },
          );

          expect(res).toEqual({
            before: 'public',
            nested: 'schema',
            after: 'public',
          });
        });

        it('sets arbitrary setConfig and restores after nested transaction', async () => {
          const getLocal = async (trx: Adapter) => {
            const res = await trx.query<{ value: string }>(
              `SELECT current_setting('app.user_id', true) as value`,
            );
            return res.rows[0].value;
          };

          const res = await adapter.transaction(
            testDb.internal.asyncStorage,
            { setConfig: { 'app.user_id': '1' } },
            async (trx) => {
              const before = await getLocal(trx);
              const nested = await trx.transaction(
                testDb.internal.asyncStorage,
                { setConfig: { 'app.user_id': '2' } },
                (nestedTrx) => getLocal(nestedTrx),
              );
              const after = await getLocal(trx);
              return { before, nested, after };
            },
          );

          expect(res).toEqual({
            before: '1',
            nested: '2',
            after: '1',
          });
        });

        it('stores transaction session context in async storage', async () => {
          await adapter.transaction(
            testDb.internal.asyncStorage,
            {
              role: 'app-user',
              setConfig: {
                'app.user_id': 1,
              },
            },
            async () => {
              const state = testDb.internal.asyncStorage.getStore();

              expect(state?.role).toBeUndefined();
              expect(state?.setConfig).toBeUndefined();
              expect(state?.transactionRole).toBe('app-user');
              expect(state?.transactionSetConfig).toMatchObject({
                'app.user_id': 1,
              });
            },
          );
        });

        it('restores top-level transaction session context when reusing existing async storage state', async () => {
          await testDb.internal.asyncStorage.run(
            {
              transactionRole: 'outer-role',
              transactionSetConfig: {
                'app.outer': 'outer-value',
              },
            },
            async () => {
              const before = testDb.internal.asyncStorage.getStore();

              expect(before?.transactionRole).toBe('outer-role');
              expect(before?.transactionSetConfig).toEqual({
                'app.outer': 'outer-value',
              });

              await adapter.transaction(
                testDb.internal.asyncStorage,
                {
                  role: 'app-user',
                  setConfig: {
                    'app.user_id': '42',
                  },
                },
                async () => {
                  const during = testDb.internal.asyncStorage.getStore();

                  expect(during?.transactionRole).toBe('app-user');
                  expect(during?.transactionSetConfig).toEqual({
                    'app.outer': 'outer-value',
                    'app.user_id': '42',
                  });
                },
              );

              const after = testDb.internal.asyncStorage.getStore();
              expect(after?.transactionRole).toBe('outer-role');
              expect(after?.transactionSetConfig).toEqual({
                'app.outer': 'outer-value',
              });
            },
          );
        });

        it('overrides and restores transaction session context for nested transactions', async () => {
          const currentRole = adapter.getUser();

          await adapter.transaction(
            testDb.internal.asyncStorage,
            {
              role: 'app-user',
              setConfig: {
                'app.user_id': '1',
              },
            },
            async (trx) => {
              const before = testDb.internal.asyncStorage.getStore();

              expect(before?.transactionRole).toBe('app-user');
              expect(before?.transactionSetConfig).toMatchObject({
                'app.user_id': '1',
              });

              const [role, userId] = await Promise.all([
                trx.query('SELECT current_role role'),
                trx.query(`SELECT current_setting('app.user_id') "userId"`),
              ]);

              expect(role).toMatchObject({ rows: [{ role: 'app-user' }] });
              expect(userId).toMatchObject({ rows: [{ userId: '1' }] });

              await trx.transaction(
                testDb.internal.asyncStorage,
                {
                  role: currentRole,
                  setConfig: {
                    'app.tenant_id': 'tenant-2',
                  },
                },
                async () => {
                  const nested = testDb.internal.asyncStorage.getStore();

                  expect(nested?.transactionRole).toBe(currentRole);
                  expect(nested?.transactionSetConfig).toMatchObject({
                    'app.user_id': '1',
                    'app.tenant_id': 'tenant-2',
                  });

                  const [role, userId, tenantId] = await Promise.all([
                    trx.query('SELECT current_role role'),
                    trx.query(`SELECT current_setting('app.user_id') "userId"`),
                    trx.query(
                      `SELECT current_setting('app.tenant_id') "tenantId"`,
                    ),
                  ]);

                  expect(role).toMatchObject({ rows: [{ role: currentRole }] });
                  expect(userId).toMatchObject({ rows: [{ userId: '1' }] });
                  expect(tenantId).toMatchObject({
                    rows: [{ tenantId: 'tenant-2' }],
                  });
                },
              );

              const after = testDb.internal.asyncStorage.getStore();

              expect(after?.transactionRole).toBe('app-user');
              expect(after?.transactionSetConfig).toEqual(
                before?.transactionSetConfig,
              );

              const [afterRole, afterUserId, afterTenantId] = await Promise.all(
                [
                  trx.query('SELECT current_role role'),
                  trx.query(`SELECT current_setting('app.user_id') "userId"`),
                  trx.query(
                    `SELECT current_setting('app.tenant_id') "tenantId"`,
                  ),
                ],
              );

              expect(afterRole).toMatchObject(role);
              expect(afterUserId).toMatchObject(userId);
              expect(afterTenantId).toMatchObject({
                rows: [{ tenantId: '' }],
              });
            },
          );

          const [afterRole, afterUserId, afterTenantId] = await Promise.all([
            adapter.query('SELECT current_role role'),
            adapter.query(
              `SELECT current_setting('app.user_id', true) "userId"`,
            ),
            adapter.query(
              `SELECT current_setting('app.tenant_id', true) "tenantId"`,
            ),
          ]);

          expect(afterRole).toMatchObject({ rows: [{ role: currentRole }] });
          expect(afterUserId).toMatchObject({ rows: [{ userId: null }] });
          expect(afterTenantId).toMatchObject({
            rows: [{ tenantId: null }],
          });
        });

        it('restores role and setConfig after nested transaction failure', async () => {
          const currentRole = adapter.getUser();

          await adapter.transaction(
            testDb.internal.asyncStorage,
            {
              role: 'app-user',
              setConfig: {
                'app.user_id': '1',
              },
            },
            async (trx) => {
              const before = testDb.internal.asyncStorage.getStore();

              expect(before?.transactionRole).toBe('app-user');
              expect(before?.transactionSetConfig).toMatchObject({
                'app.user_id': '1',
              });

              await expect(
                trx.transaction(
                  testDb.internal.asyncStorage,
                  {
                    role: currentRole,
                    setConfig: {
                      'app.tenant_id': 'tenant-2',
                    },
                  },
                  async () => {
                    const nested = testDb.internal.asyncStorage.getStore();

                    expect(nested?.transactionRole).toBe(currentRole);
                    expect(nested?.transactionSetConfig).toMatchObject({
                      'app.user_id': '1',
                      'app.tenant_id': 'tenant-2',
                    });

                    await trx.query(
                      'SELECT * FROM "schema"."table_that_does_not_exist"',
                    );
                  },
                ),
              ).rejects.toThrow();

              const after = testDb.internal.asyncStorage.getStore();

              expect(after?.transactionRole).toBe('app-user');
              expect(after?.transactionSetConfig).toEqual(
                before?.transactionSetConfig,
              );

              const [role, userId, tenantId] = await Promise.all([
                trx.query('SELECT current_role role'),
                trx.query(`SELECT current_setting('app.user_id') "userId"`),
                trx.query(
                  `SELECT current_setting('app.tenant_id', true) "tenantId"`,
                ),
              ]);

              expect(role).toMatchObject({ rows: [{ role: 'app-user' }] });
              expect(userId).toMatchObject({ rows: [{ userId: '1' }] });
              expect(tenantId).toMatchObject({ rows: [{ tenantId: '' }] });
            },
          );
        });

        it('restores effective parent context for deeper nested transactions', async () => {
          const currentRole = adapter.getUser();

          await adapter.transaction(
            testDb.internal.asyncStorage,
            {
              role: 'app-user',
              setConfig: {
                'app.user_id': '1',
              },
            },
            async (trx) => {
              await trx.transaction(
                testDb.internal.asyncStorage,
                {
                  role: currentRole,
                  setConfig: {
                    'app.tenant_id': 'tenant-2',
                  },
                },
                async () => {
                  await trx.transaction(
                    testDb.internal.asyncStorage,
                    {
                      role: 'app-user',
                      setConfig: {
                        'app.user_id': '3',
                        'app.project_id': 'project-3',
                      },
                    },
                    async () => {
                      const [role, userId, tenantId, projectId] =
                        await Promise.all([
                          trx.query('SELECT current_role role'),
                          trx.query(
                            `SELECT current_setting('app.user_id') "userId"`,
                          ),
                          trx.query(
                            `SELECT current_setting('app.tenant_id') "tenantId"`,
                          ),
                          trx.query(
                            `SELECT current_setting('app.project_id') "projectId"`,
                          ),
                        ]);

                      expect(role).toMatchObject({
                        rows: [{ role: 'app-user' }],
                      });
                      expect(userId).toMatchObject({ rows: [{ userId: '3' }] });
                      expect(tenantId).toMatchObject({
                        rows: [{ tenantId: 'tenant-2' }],
                      });
                      expect(projectId).toMatchObject({
                        rows: [{ projectId: 'project-3' }],
                      });
                    },
                  );

                  const [role, userId, tenantId, projectId] = await Promise.all(
                    [
                      trx.query('SELECT current_role role'),
                      trx.query(
                        `SELECT current_setting('app.user_id') "userId"`,
                      ),
                      trx.query(
                        `SELECT current_setting('app.tenant_id') "tenantId"`,
                      ),
                      trx.query(
                        `SELECT current_setting('app.project_id', true) "projectId"`,
                      ),
                    ],
                  );

                  expect(role).toMatchObject({ rows: [{ role: currentRole }] });
                  expect(userId).toMatchObject({ rows: [{ userId: '1' }] });
                  expect(tenantId).toMatchObject({
                    rows: [{ tenantId: 'tenant-2' }],
                  });
                  expect(projectId).toMatchObject({
                    rows: [{ projectId: '' }],
                  });
                },
              );

              const [role, userId, tenantId, projectId] = await Promise.all([
                trx.query('SELECT current_role role'),
                trx.query(`SELECT current_setting('app.user_id') "userId"`),
                trx.query(
                  `SELECT current_setting('app.tenant_id', true) "tenantId"`,
                ),
                trx.query(
                  `SELECT current_setting('app.project_id', true) "projectId"`,
                ),
              ]);

              expect(role).toMatchObject({ rows: [{ role: 'app-user' }] });
              expect(userId).toMatchObject({ rows: [{ userId: '1' }] });
              expect(tenantId).toMatchObject({ rows: [{ tenantId: '' }] });
              expect(projectId).toMatchObject({ rows: [{ projectId: '' }] });
            },
          );
        });

        it('keeps withOptions nested-scope behavior unchanged inside transaction context', async () => {
          await adapter.transaction(
            testDb.internal.asyncStorage,
            {
              role: 'app-user',
              setConfig: {
                'app.tx': 'value',
              },
            },
            async () => {
              await testDb.withOptions({ role: 'app_user' }, async () => {
                const state = testDb.internal.asyncStorage.getStore();

                expect(state?.transactionRole).toBe('app-user');
                expect(state?.role).toBe('app_user');

                await expect(
                  testDb.withOptions({ role: 'other_role' }, async () => {}),
                ).rejects.toThrow(OrchidOrmInternalError);
              });

              await testDb.withOptions(
                { setConfig: { 'app.scope_a': 'a' } },
                async () => {
                  await expect(
                    testDb.withOptions(
                      { setConfig: { 'app.scope_b': 'b' } },
                      async () => {},
                    ),
                  ).rejects.toThrow(OrchidOrmInternalError);
                },
              );
            },
          );
        });
      });

      describe('hackySavepoint', () => {
        const getCounterValue = async (trx: Adapter) => {
          const res = await trx.query<{ value: number }>(getCounterValueSql);
          return res.rows[0].value;
        };

        beforeEach(async () => {
          await adapter.query(`UPDATE ${counterTable} SET "value" = 0`);
        });

        it('persists savepoint changes after release', async () => {
          const before = await getCounterValue(adapter);

          await adapter.transaction(undefined, undefined, async (trx) => {
            const state: HackySavepointState = { name: 'hacky_release' };

            const res = await trx.hackySavepoint<{ value: number }>(
              state,
              `${incrementCounterSql} RETURNING "value"`,
            );

            expect(res.rows[0].value).toBe(before + 1);

            await trx.query(incrementCounterSql);

            await state.activeSavepoint!.release();
          });

          const after = await getCounterValue(adapter);
          expect(after).toBe(before + 2);
        });

        it('rolls back savepoint changes when rollback is called', async () => {
          const before = await getCounterValue(adapter);
          const err = new Error('rollback savepoint');

          await adapter.transaction(undefined, undefined, async (trx) => {
            const state: HackySavepointState = { name: 'hacky_rollback' };

            await trx.hackySavepoint(state, incrementCounterSql);
            await trx.query(incrementCounterSql);

            await state.activeSavepoint!.rollback(err);
          });

          const after = await getCounterValue(adapter);
          expect(after).toBe(before);
        });

        it('continues transaction after savepoint rollback', async () => {
          const before = await getCounterValue(adapter);

          await adapter.transaction(undefined, undefined, async (trx) => {
            const state: HackySavepointState = { name: 'hacky_continue' };

            await trx.hackySavepoint(state, incrementCounterSql);
            await trx.query(incrementCounterSql);

            await state.activeSavepoint!.rollback(new Error('rollback'));

            await trx.query(incrementCounterSql);
          });

          const after = await getCounterValue(adapter);
          expect(after).toBe(before + 1);
        });

        it('auto-rolls back on savepoint query failure and release fails afterwards', async () => {
          const before = await getCounterValue(adapter);

          await adapter.transaction(undefined, undefined, async (trx) => {
            const state: HackySavepointState = { name: 'hacky_query_fail' };

            await expect(
              trx.hackySavepoint(
                state,
                'SELECT * FROM "table_that_does_not_exist"',
              ),
            ).rejects.toThrow();

            await expect(state.activeSavepoint!.release()).rejects.toThrow();

            await trx.query(incrementCounterSql);
          });

          const after = await getCounterValue(adapter);
          expect(after).toBe(before + 1);
        });
      });

      describe('sql session state', () => {
        it('applies role in query', async () => {
          const withRole = await adapter.query<{ current_user: string }>(
            'SELECT current_user',
            undefined,
            { role: 'app-user' },
          );

          expect(withRole.rows[0].current_user).toBe('app-user');
        });

        it('applies setConfig in query', async () => {
          const during = await adapter.query<{ preset: string; fresh: string }>(
            `SELECT
              current_setting('app.preset_key', true) as preset,
              current_setting('app.new_key', true) as fresh`,
            undefined,
            {
              setConfig: {
                'app.preset_key': 'new_preset_value',
                'app.new_key': 'new_value',
              },
            },
          );

          expect(during.rows[0]).toEqual({
            preset: 'new_preset_value',
            fresh: 'new_value',
          });
        });

        it('applies setConfig in transaction query', async () => {
          await adapter.transaction(undefined, undefined, async (trx) => {
            const during = await trx.query<{ preset: string; fresh: string }>(
              `SELECT
                current_setting('app.preset_key', true) as preset,
                current_setting('app.new_key', true) as fresh`,
              undefined,
              {
                setConfig: {
                  'app.preset_key': 'new_preset_value',
                  'app.new_key': 'new_value',
                },
              },
            );

            expect(during.rows[0]).toEqual({
              preset: 'new_preset_value',
              fresh: 'new_value',
            });
          });
        });

        it('applies setConfig in arrays query', async () => {
          const during = await adapter.arrays<[string, string]>(
            `SELECT
              current_setting('app.arr_preset', true),
              current_setting('app.arr_new', true)`,
            undefined,
            {
              setConfig: {
                'app.arr_preset': 'new_preset',
                'app.arr_new': 'new_val',
              },
            },
          );

          expect(during.rows[0]).toEqual(['new_preset', 'new_val']);
        });

        it('applies sqlSessionState from transaction options', async () => {
          await adapter.transaction(
            undefined,
            {
              setConfig: {
                'app.trx_preset': 'inner_value',
              },
            },
            async (trx) => {
              const duringConfig = await trx.query<{ val: string }>(
                `SELECT current_setting('app.trx_preset', true) as val`,
              );

              expect(duringConfig.rows[0].val).toBe('inner_value');
            },
          );
        });
      });

      it('assigns db error properties to QueryError', async () => {
        let duplicateId = 0;
        const dbErr = await adapter
          .transaction(undefined, undefined, async (trx) => {
            const inserted = await trx.query<{ id: number }>(
              `INSERT INTO "schema"."user"("name", "password")
               VALUES ('name', 'password')
               RETURNING "id"`,
            );
            duplicateId = inserted.rows[0].id;

            await trx.query(
              `INSERT INTO "schema"."user"("id", "name", "password")
               VALUES (${duplicateId}, 'name', 'password')`,
            );
          })
          .catch((err) => err as Error);

        class TestError extends QueryError {}
        const err = new TestError({} as never);
        adapter.assignError(err, dbErr as never);

        expect(err).toMatchObject({
          message: 'duplicate key value violates unique constraint "user_pkey"',
          code: '23505',
          detail: `Key (id)=(${duplicateId}) already exists.`,
          severity: 'ERROR',
        });
      });
    });
  });
});
