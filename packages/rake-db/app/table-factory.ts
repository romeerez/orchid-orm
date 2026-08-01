import { createTableFactory } from 'orchid-orm';

export const { defineTable } = createTableFactory({
  snakeCase: true,
  columnTypes: (t) => ({
    ...t,
    id() {
      return t.identity.call(this).primaryKey();
    },
  }),
});
