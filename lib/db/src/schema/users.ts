import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  isAdmin: boolean("is_admin").notNull().default(false),
  totalProfit: numeric("total_profit", { precision: 15, scale: 2 }).notNull().default("0.00"),
  biggestWin: numeric("biggest_win", { precision: 15, scale: 2 }).notNull().default("0.00"),
  biggestBet: numeric("biggest_bet", { precision: 15, scale: 2 }).notNull().default("0.00"),
  gamesPlayed: text("games_played").notNull().default("0"),
  winStreak: text("win_streak").notNull().default("0"),
  currentStreak: text("current_streak").notNull().default("0"),
  totalWins: text("total_wins").notNull().default("0"),
  totalLosses: text("total_losses").notNull().default("0"),
  lastDailyClaim: timestamp("last_daily_claim", { withTimezone: true }),
  lastBetAt: timestamp("last_bet_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
