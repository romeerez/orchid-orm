import { createBaseTable } from './baseTable';
import { testAdapter, testColumnTypes } from 'test-utils';
import { orchidORM } from './orm';
import { useTestORM } from './test-utils/test-utils';

export const BaseTable = createBaseTable({
  columnTypes: testColumnTypes,
});

export class LocationTable extends BaseTable {
  readonly table = 'location';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
  }));

  relations = {
    links: this.hasMany(() => LocationLinkTable, {
      columns: ['id'],
      references: ['locationId'],
    }),
  };
}

export class LocationLinkTable extends BaseTable {
  readonly table = 'location_link';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    locationId: t.uuid().foreignKey(() => LocationTable, 'id'),
    url: t.varchar(),
    ...t.unique(['url', 'locationId']),
  }));

  relations = {
    location: this.belongsTo(() => LocationTable, {
      columns: ['locationId'],
      references: ['id'],
    }),
  };
}

const db = orchidORM(
  {
    adapter: testAdapter,
    log: true,
  },
  {
    location: LocationTable,
    locationLink: LocationLinkTable,
  },
);

useTestORM();

it('test', async () => {
  const location = await db.location.create({});

  await db.location.find(location.id).update({
    links: {
      set: [{ url: 'new url' }],
    },
  });

  // const urls = ['new url'];
  //
  // await db.$transaction(async () => {
  //   await db.location.links.delete();
  //   await db.locationLink.createMany(
  //     urls.map((url) => ({
  //       locationId: location.id,
  //       url,
  //     })),
  //   );
  // });
});
