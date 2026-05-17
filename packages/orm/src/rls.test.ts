import { assertType, BaseTable, testAdapter } from 'test-utils';
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
    });

    assertType<typeof rls, { enable: true; force: false }>();
    expect(rls).toEqual({
      enable: true,
      force: false,
    });
  });
});
