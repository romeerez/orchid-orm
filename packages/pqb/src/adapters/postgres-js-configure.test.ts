jest.mock('postgres', () => {
  const fn = jest.fn(() => ({
    options: {
      shared: { typeArrayMap: {} },
      parsers: {},
      serializers: {},
    },
  }));
  (fn as unknown as { PostgresError: unknown }).PostgresError =
    class PostgresError extends Error {};
  return { __esModule: true, default: fn };
});

import { PostgresJsAdapter } from './postgres-js';

describe('postgres-js configure', () => {
  it('passes caller types alongside the adapter parsers', () => {
    const bigint = { to: 20, from: 20 };

    PostgresJsAdapter.configure({
      databaseURL: 'postgres://example',
      types: { bigint },
    } as never);

    const postgres = jest.requireMock('postgres').default;
    expect(postgres).toHaveBeenCalledWith(
      'postgres://example',
      expect.objectContaining({
        types: expect.objectContaining({
          bigint,
          json: expect.anything(),
        }),
      }),
    );
  });
});
