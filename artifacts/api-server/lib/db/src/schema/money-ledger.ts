import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const moneyLedgerTable = pgTable("money_ledger", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 25, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MoneyLedgerEntry = typeof moneyLedgerTable.$inferSelect;
