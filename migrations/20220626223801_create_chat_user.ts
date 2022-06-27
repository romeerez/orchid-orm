import { Migration } from 'rake-db'

export const change = (db: Migration) => {
  db.createTable('chatUser', (t) => {
    t.integer('chatId').required().references('chat', 'id')
    t.integer('userId').required().references('user', 'id')
    t.index(['chatId', 'userId'], { unique: true })
    t.timestamps()
  })
}
