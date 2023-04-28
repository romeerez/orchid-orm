import { BaseTable } from '../baseTable';
import { UserTable } from './user';

export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').nullable(),
    bio: t.text(0, Infinity).nullable(),
    ...t.timestamps(),
  }));
  
  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  };
}
