import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    tokenHash: text('token_hash').primaryKey(),
    version: integer('version').notNull().default(0),
    payload: text('payload').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_workspaces_updated_at').on(table.updatedAt)],
);
