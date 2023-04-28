import { BaseTable } from '../baseTable';
import { ChatUserTable } from './chatUser';
import { MessageTable } from './message';

export class ChatTable extends BaseTable {
  readonly table = 'chat';
  columns = this.setColumns((t) => ({
    idOfChat: t.identity().primaryKey(),
    title: t.text(0, Infinity),
    ...t.timestamps(),
  }));

  relations = {
    chatUsers: this.hasMany(() => ChatUserTable, {
      primaryKey: 'idOfChat',
      foreignKey: 'chatId',
    }),
    messages: this.hasMany(() => MessageTable, {
      primaryKey: 'idOfChat',
      foreignKey: 'chatId',
    }),
  };
}
