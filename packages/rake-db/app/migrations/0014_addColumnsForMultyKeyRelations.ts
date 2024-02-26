import { change } from '../dbScript';

change(async (db) => {
  for (const table of ['user', 'profile', 'message', 'chat']) {
    const column = `${table}Key`;
    await db.changeTable(table, (t) => ({
      [column]: t.add(t.text().nullable()),
    }));
  }

  await db.changeTable('chatUser', (t) => ({
    userKey: t.add(t.text()),
    chatKey: t.add(t.text()),
  }));
});
