import { BaseTable } from '../baseTable';
import { ProfileTable } from './profile';
import { ChatUserTable } from './chatUser';
import { MessageTable } from './message';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(0, Infinity),
    password: t.text(0, Infinity),
    picture: t.text(0, Infinity).nullable(),
    data: t.json((t) => t.any()).nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));

  relations = {
    profiles: this.hasMany(() => ProfileTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
    chatUsers: this.hasMany(() => ChatUserTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),
  };
}
