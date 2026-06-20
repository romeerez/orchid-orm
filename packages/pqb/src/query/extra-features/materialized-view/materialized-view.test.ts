import { assertType, testDb } from 'test-utils';
import { User } from '../../../test-utils/pqb.test-utils';
import { Query } from '../../query';
import { refreshMaterializedView } from './materialized-view.query';

describe('materialized view query', () => {
  const view = testDb(
    'materialized_view',
    (t) => ({
      id: t.identity().primaryKey(),
    }),
    undefined,
    { materialized: true, readOnly: true },
  );

  const viewWithoutSchema = view.withSchema(undefined);

  afterAll(testDb.close);

  it('refreshes a schema-qualified materialized view', async () => {
    const query = jest
      .spyOn(view.q.adapter, 'query')
      .mockResolvedValue({ rowCount: 0, rows: [], fields: [] });

    await refreshMaterializedView(view, {
      concurrently: true,
      withData: true,
    });

    expect(query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY "schema"."materialized_view" WITH DATA',
      [],
    );

    query.mockRestore();
  });

  it('refreshes a materialized view without optional clauses', async () => {
    const query = jest
      .spyOn(viewWithoutSchema.q.adapter, 'query')
      .mockResolvedValue({ rowCount: 0, rows: [], fields: [] });

    await refreshMaterializedView(viewWithoutSchema);

    expect(query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW "materialized_view"',
      [],
    );

    query.mockRestore();
  });

  it('executes refresh SQL and accepts only materialized queries', async () => {
    assertType<typeof view.__materialized, true>();
    const expectMaterialized = <T extends Query.MaterializedQuery>(query: T) =>
      query;
    expectMaterialized(view);

    const query = jest
      .spyOn(view.q.adapter, 'query')
      .mockResolvedValue({ rowCount: 0, rows: [], fields: [] });

    await refreshMaterializedView(view, { withData: false });

    expect(query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW "schema"."materialized_view" WITH NO DATA',
      [],
    );

    query.mockRestore();

    // @ts-expect-error regular query is not materialized
    await expect(() => refreshMaterializedView(User)).rejects.toThrow();
  });

  it('rejects concurrent refresh with no data before SQL execution', async () => {
    const query = jest.spyOn(view.q.adapter, 'query');

    await expect(
      refreshMaterializedView(view, {
        concurrently: true,
        withData: false,
      }),
    ).rejects.toThrow(
      'Cannot refresh a materialized view concurrently with WITH NO DATA',
    );

    expect(query).not.toHaveBeenCalled();

    query.mockRestore();
  });
});
