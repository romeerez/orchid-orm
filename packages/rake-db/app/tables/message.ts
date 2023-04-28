import { BaseTable } from '../baseTable';
import { ChatTable } from './chat';
import { UserTable } from './user';

export class MessageTable extends BaseTable {
  readonly table = 'message';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    chatId: t.integer().foreignKey('chat', 'idOfChat').index(),
    authorId: t.integer().foreignKey('user', 'id').nullable().index(),
    text: t.text(0, Infinity),
    meta: t.json((t) => t.any()).nullable(),
    ...t.timestamps(),
  }));
  
  relations = {
    chat: this.belongsTo(() => ChatTable, {
      primaryKey: 'idOfChat',
      foreignKey: 'chatId',
    }),
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'authorId',
    }),
  };
}
