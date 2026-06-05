import { BaseTable, testAdapter } from 'test-utils';
import { defineRls, orchidORMWithAdapter } from './orm';

describe('rls', () => {
  class UserTable extends BaseTable {
    readonly table = 'user';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
    }));
  }

  it('should store rls options in db internal when provided', () => {
    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        rls: {
          tableRlsDefaults: {
            enable: true,
            force: false,
          },
        },
      },
      { user: UserTable },
    );

    expect(db.$qb.internal.rls).toEqual({
      tableRlsDefaults: {
        enable: true,
        force: false,
      },
    });
  });

  it('should keep internal rls undefined when option is omitted', () => {
    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
      },
      { user: UserTable },
    );

    expect(db.$qb.internal.rls).toBe(undefined);
  });

  it('should define rls config with identity helper', () => {
    const rls = defineRls({
      enable: true,
      force: false,
      permit: [
        {
          name: 'user_select_policy',
          for: 'SELECT',
          to: 'public',
          using: BaseTable.sql`id > 0`,
        },
      ],
      restrict: [
        {
          name: 'user_update_policy',
          for: 'UPDATE',
          to: 'public',
          using: BaseTable.sql`id > 0`,
          withCheck: BaseTable.sql`id > 0`,
        },
      ],
    });

    expect(rls).toEqual({
      enable: true,
      force: false,
      permit: [
        {
          name: 'user_select_policy',
          for: 'SELECT',
          to: 'public',
          using: expect.anything(),
        },
      ],
      restrict: [
        {
          name: 'user_update_policy',
          for: 'UPDATE',
          to: 'public',
          using: expect.anything(),
          withCheck: expect.anything(),
        },
      ],
    });
  });

  it('should enforce policy for/using/withCheck combinations', () => {
    defineRls({
      permit: [
        {
          name: 'valid_select',
          for: 'SELECT',
          to: 'public',
          using: BaseTable.sql`id > 0`,
        },
        {
          name: 'valid_insert',
          for: 'INSERT',
          to: 'public',
          withCheck: BaseTable.sql`id > 0`,
        },
        {
          name: 'valid_all',
          to: 'public',
          using: BaseTable.sql`id > 0`,
          withCheck: BaseTable.sql`id > 0`,
        },
      ],
    });

    defineRls({
      permit: [
        // @ts-expect-error withCheck is not allowed for SELECT
        {
          name: 'invalid_select',
          for: 'SELECT',
          to: 'public',
          using: BaseTable.sql`id > 0`,
          withCheck: BaseTable.sql`id > 0`,
        },
      ],
    });

    defineRls({
      permit: [
        // @ts-expect-error using is not allowed for INSERT
        {
          name: 'invalid_insert',
          for: 'INSERT',
          to: 'public',
          using: BaseTable.sql`id > 0`,
          withCheck: BaseTable.sql`id > 0`,
        },
      ],
    });

    defineRls({
      permit: [
        // @ts-expect-error to is required
        {
          name: 'invalid_missing_to',
          for: 'SELECT',
          using: BaseTable.sql`id > 0`,
        },
      ],
    });
  });
});
