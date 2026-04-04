/**
 * Transaction Watchdog
 *
 * Runs every 60 seconds. Verifies that the global pool balance matches the
 * expected value derived from every recorded bet, admin refill, and casino tax.
 *
 * Expected pool formula (all-time):
 *   expected = baseline_pool
 *            + sum(bets.bet_amount - bets.payout)   ← global pool bets only
 *            + sum(money_ledger.amount WHERE eventType = 'admin_refill_pool')
 *            + sum(monthly_tax_logs.tax_amount)
 *
 * If actual pool deviates by more than $0.01 the watchdog logs a warning and
 * writes a corrective update back to the pool, recording it in money_ledger so
 * the adjustment is always auditable.
 */

import { db, poolTable, betsTable, moneyLedgerTable, settingsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { logger } from "./logger";
import { monthlyTaxLogsTable } from "@workspace/db";

const WATCHDOG_BASELINE_KEY = "watchdog_baseline_pool";
const DRIFT_THRESHOLD = 0.01; // $0.01

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export async function runWatchdog(): Promise<void> {
  try {
    const [poolRow] = await db.select().from(poolTable).limit(1);
    if (!poolRow) return;
    const actualPool = parseFloat(poolRow.totalAmount);

    // --- Sum of all global bets and payouts (pool-mode only — casino bets live in casino_bets) ---
    const [betTotals] = await db
      .select({
        totalBets: sql<string>`COALESCE(SUM(${betsTable.betAmount}), 0)`,
        totalPayouts: sql<string>`COALESCE(SUM(${betsTable.payout}), 0)`,
      })
      .from(betsTable);

    const totalBets = parseFloat(betTotals?.totalBets ?? "0");
    const totalPayouts = parseFloat(betTotals?.totalPayouts ?? "0");
    const netFromBets = totalBets - totalPayouts;

    // --- Sum of all admin pool refills ---
    const [refillTotals] = await db
      .select({ total: sql<string>`COALESCE(SUM(${moneyLedgerTable.amount}), 0)` })
      .from(moneyLedgerTable)
      .where(sql`${moneyLedgerTable.eventType} = 'admin_refill_pool'`);

    const totalRefills = parseFloat(refillTotals?.total ?? "0");

    // --- Sum of all casino taxes that flowed into the pool ---
    const [taxTotals] = await db
      .select({ total: sql<string>`COALESCE(SUM(${monthlyTaxLogsTable.taxAmount}), 0)` })
      .from(monthlyTaxLogsTable);

    const totalTaxes = parseFloat(taxTotals?.total ?? "0");

    // --- Establish or read the baseline ---
    const baselineStr = await getSetting(WATCHDOG_BASELINE_KEY);

    if (baselineStr === null) {
      // First run — establish the baseline pool amount at this exact moment.
      // The formula is:  baseline = actual - netFromBets - refills - taxes
      // so that expected = baseline + netFromBets + refills + taxes = actual ✓
      const baseline = actualPool - netFromBets - totalRefills - totalTaxes;
      await setSetting(WATCHDOG_BASELINE_KEY, baseline.toFixed(2));
      logger.info({ baseline: baseline.toFixed(2), actualPool }, "Watchdog: baseline established");
      return;
    }

    const baseline = parseFloat(baselineStr);
    const expectedPool = baseline + netFromBets + totalRefills + totalTaxes;
    const drift = actualPool - expectedPool;

    if (Math.abs(drift) < DRIFT_THRESHOLD) {
      logger.debug(
        { actualPool, expectedPool, drift: drift.toFixed(4) },
        "Watchdog: pool balanced ✓"
      );
      return;
    }

    // ---- Discrepancy detected ----
    logger.warn(
      {
        actualPool,
        expectedPool: expectedPool.toFixed(2),
        drift: drift.toFixed(4),
        totalBets,
        totalPayouts,
        totalRefills,
        totalTaxes,
        baseline,
      },
      "Watchdog: pool drift detected — auto-correcting"
    );

    // Auto-correct: set pool to expected value and log the correction
    await db.transaction(async (tx) => {
      await tx
        .update(poolTable)
        .set({ totalAmount: expectedPool.toFixed(2) })
        .where(eq(poolTable.id, poolRow.id));

      // Record the correction in the money ledger so it's always auditable
      const correctionDirection = drift > 0 ? "out" : "in";
      await tx.insert(moneyLedgerTable).values({
        eventType: "watchdog_correction",
        direction: correctionDirection,
        amount: Math.abs(drift).toFixed(2),
        description: `Watchdog auto-correction: pool drifted by $${drift.toFixed(4)} — adjusted to expected $${expectedPool.toFixed(2)}`,
      });
    });

    logger.info(
      { before: actualPool, after: expectedPool.toFixed(2), correction: drift.toFixed(4) },
      "Watchdog: pool corrected"
    );
  } catch (err) {
    logger.error({ err }, "Watchdog: error during run");
  }
}

export function startWatchdog(): void {
  // Run immediately on start, then every 60 seconds
  setTimeout(async () => {
    await runWatchdog();
    setInterval(runWatchdog, 60_000);
  }, 5_000); // 5-second delay after server boot so DB is ready

  logger.info("Transaction watchdog started (60s interval)");
}
