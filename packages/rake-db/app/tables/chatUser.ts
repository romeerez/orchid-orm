import { BaseTable } from '../baseTable';
import { ChatTable } from './chat';
import { UserTable } from './user';

export class ChatUserTable extends BaseTable {
  readonly table = 'chatUser';
  columns = this.setColumns((t) => ({
    chatId: t.integer().foreignKey('chat', 'idOfChat'),
    userId: t.integer().foreignKey('user', 'id'),
    ...t.timestamps(),
    ...t.primaryKey(['chatId', 'userId']),
  }));
  
  relations = {
    chat: this.belongsTo(() => ChatTable, {
      primaryKey: 'idOfChat',
      foreignKey: 'chatId',
    }),
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}
