import { db, pool, badgesTable, userBadgesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function checkAndAwardBadges(userId: number): Promise<string[]> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return [];

  const allBadges = await db.select().from(badgesTable);
  const earned = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId));
  const earnedIds = new Set(earned.map(e => e.badgeId));

  const gamesPlayed = parseInt(user.gamesPlayed);
  const winStreak = parseInt(user.winStreak);
  const biggestBet = parseFloat(user.biggestBet);

  const pvpWinsRow = await pool.query(
    `SELECT COUNT(*) as c FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = $1 AND m.winner_id = $1 AND m.status = 'completed'`,
    [userId]
  );
  const pvpWins = parseInt((pvpWinsRow.rows?.[0] as any)?.c ?? "0");

  const newlyEarned: string[] = [];

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    let earned = false;

    switch (badge.requirementType) {
      case "games_played":
        earned = gamesPlayed >= badge.requirementValue;
        break;
      case "win_streak":
        earned = winStreak >= badge.requirementValue;
        break;
      case "biggest_bet":
        earned = biggestBet >= badge.requirementValue;
        break;
      case "pvp_wins":
        earned = pvpWins >= badge.requirementValue;
        break;
      case "game_first": {
        if (badge.requirementGame) {
          const row = await pool.query(
            `SELECT COUNT(*) as c FROM bets WHERE user_id = $1 AND game_type = $2`,
            [userId, badge.requirementGame]
          );
          earned = parseInt((row.rows?.[0] as any)?.c ?? "0") >= 1;
        }
        break;
      }
    }

    if (earned) {
      await db.insert(userBadgesTable).values({
        userId,
        badgeId: badge.id,
        claimed: false,
        progress: badge.requirementValue,
      }).onConflictDoNothing();
      newlyEarned.push(badge.name);
    }
  }

  return newlyEarned;
}
