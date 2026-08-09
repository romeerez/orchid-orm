import { Query } from 'pqb';
import {
  _queryFindBy,
  _queryFindByOptional,
  _queryCreateMany,
  RecordUnknown,
} from 'pqb/internal';
import {
  NestedInsertManyConnect,
  NestedInsertManyConnectOrCreate,
  NestedInsertManyItems,
} from '../common/utils';
import { HasManyNestedInsert } from '../has-many/has-many.create';
import { State } from './has-and-belongs-to-many';

export const nestedInsert = ({
  relatedTableQuery,
  joinTableQuery,
  primaryKeys,
  foreignKeys,
  throughPrimaryKeys,
  throughForeignKeys,
}: State) => {
  const len = primaryKeys.length;
  const throughLen = primaryKeys.length;

  return (async (_, data) => {
    const t = relatedTableQuery.clone();

    // array to store specific items will be reused
    const items: unknown[] = [];
    for (const item of data) {
      if (item[1].connect) {
        items.push(item);
      }
    }

    let connected: RecordUnknown[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connect }] of items as [
        unknown,
        { connect: NestedInsertManyConnect },
      ][]) {
        for (const item of connect) {
          queries.push(
            _queryFindBy(
              t.select(...throughPrimaryKeys),
              item as never,
            ) as Query,
          );
        }
      }

      connected = (await Promise.all(queries)) as Record<string, unknown[]>[];
    } else {
      connected = [];
    }

    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        items.push(item);
      }
    }

    let connectOrCreated: (RecordUnknown | undefined)[];
    if (items.length) {
      const queries: Query[] = [];

      for (const [, { connectOrCreate }] of items as [
        unknown,
        { connectOrCreate: NestedInsertManyConnectOrCreate },
      ][]) {
        for (const item of connectOrCreate) {
          queries.push(
            _queryFindByOptional(
              t.select(...throughPrimaryKeys),
              item.where as never,
            ) as Query,
          );
        }
      }

      connectOrCreated = (await Promise.all(queries)) as RecordUnknown[];
    } else {
      connectOrCreated = [];
    }

    let connectOrCreateI = 0;
    items.length = 0;
    for (const item of data) {
      if (item[1].connectOrCreate) {
        const length = item[1].connectOrCreate.length;
        connectOrCreateI += length;
        for (let i = length; i > 0; i--) {
          if (!connectOrCreated[connectOrCreateI - i]) {
            items.push(item);
            break;
          }
        }
      } else if (item[1].create) {
        items.push(item);
      }
    }

    connectOrCreateI = 0;
    let created: RecordUnknown[];
    if (items.length) {
      const records: RecordUnknown[] = [];

      for (const [, { create, connectOrCreate }] of items as [
        unknown,
        NestedInsertManyItems,
      ][]) {
        if (create) {
          records.push(...create);
        }

        if (connectOrCreate) {
          for (const item of connectOrCreate) {
            if (!connectOrCreated[connectOrCreateI++]) {
              records.push(item.create);
            }
          }
        }
      }

      created = (await _queryCreateMany(
        t.select(...throughPrimaryKeys),
        records,
      )) as never;
    } else {
      created = [];
    }

    const allKeys = data as unknown as [
      selfData: RecordUnknown,
      relationKeys: RecordUnknown[],
    ][];

    let createI = 0;
    let connectI = 0;
    connectOrCreateI = 0;
    for (let index = 0, len = data.length; index < len; index++) {
      const item = data[index][1] as NestedInsertManyItems;

      if (item.create || item.connectOrCreate) {
        if (item.create) {
          const len = item.create.length;
          allKeys[index][1] = created.slice(createI, createI + len);
          createI += len;
        }
        if (item.connectOrCreate) {
          const arr: RecordUnknown[] = [];
          allKeys[index][1] = arr;

          const len = item.connectOrCreate.length;
          for (let i = 0; i < len; i++) {
            const item = connectOrCreated[connectOrCreateI++];
            if (item) {
              arr.push(item);
            } else {
              arr.push(created[createI++]);
            }
          }
        }
      }

      if (item.connect) {
        const len = item.connect.length;
        allKeys[index][1] = connected.slice(connectI, connectI + len);
        connectI += len;
      }
    }

    const records: RecordUnknown[] = [];
    for (const [selfData, relationKeys] of allKeys) {
      const obj: RecordUnknown = {};
      for (let i = 0; i < len; i++) {
        obj[foreignKeys[i]] = selfData[primaryKeys[i]];
      }

      for (const relationData of relationKeys) {
        const record = { ...obj };

        for (let i = 0; i < throughLen; i++) {
          record[throughForeignKeys[i]] = relationData[throughPrimaryKeys[i]];
        }

        records.push(record);
      }
    }

    await (joinTableQuery as Query.NotReadOnlyQuery).insertMany(records);
  }) as HasManyNestedInsert;
};
