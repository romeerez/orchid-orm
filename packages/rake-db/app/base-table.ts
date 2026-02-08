import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  snakeCase: true,
  columnTypes: (t) => ({
    ...t,
    id() {
      return t.identity.call(this).primaryKey();
    },
  }),
});
