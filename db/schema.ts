import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const brands = sqliteTable(
  "brands",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    employee: text("employee").notNull().default(""),
    season: text("season").notNull().default(""),
    assetStatus: text("asset_status").notNull().default("Not requested"),
    assignee: text("assignee").notNull().default("Specialist 1"),
    status: text("status").notNull().default("Starting"),
    progress: integer("progress").notNull().default(0),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("brands_name_unique").on(table.name)],
);
