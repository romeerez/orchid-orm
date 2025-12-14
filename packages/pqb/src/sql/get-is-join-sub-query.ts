import { PickQueryQAndBaseQuery, RecordBoolean, RecordUnknown } from 'pqb';

export const skipQueryKeysForSubQuery: RecordBoolean = {
  adapter: true,
  updateData: true,
  parsers: true,
  as: true,
  and: true,
  or: true,
  returnType: true,
  joinedShapes: true,
  returnsOne: true,
  aliases: true,
  defaults: true,
  transform: true,
  throwOnNotFound: true,
  before: true,
  after: true,
  beforeCreate: true,
  afterCreate: true,
  afterCreateCommit: true,
  afterCreateSelect: true,
  beforeUpdate: true,
  afterUpdate: true,
  afterUpdateCommit: true,
  afterUpdateSelect: true,
  afterSave: true,
  afterSaveCommit: true,
  afterSaveSelect: true,
  beforeDelete: true,
  afterDelete: true,
  afterDeleteCommit: true,
  afterDeleteSelect: true,
  catchAfterCommitErrors: true,
  log: true,
  logger: true,
  autoPreparedStatements: true,
  catch: true,
};

// extracted from `join` to prevent circular dependencies between query join and sql join
export const getIsJoinSubQuery = (query: PickQueryQAndBaseQuery) => {
  const {
    q,
    baseQuery: { q: baseQ },
  } = query;
  for (const key in q) {
    if (
      !skipQueryKeysForSubQuery[key] &&
      (q as never as RecordUnknown)[key] !==
        (baseQ as never as RecordUnknown)[key]
    ) {
      return true;
    }
  }
  return false;
};
