import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    id() {
      return t.identity.call(this).primaryKey();
    },
    text(min = 0, max = Infinity) {
      return t.text.call(this, min, max);
    },
  }),
});
