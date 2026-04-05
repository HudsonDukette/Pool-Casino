/**
 * Transaction Watchdog
 *
 * Runs every 60 seconds. Verifies that the global pool balance matches the
 * expected value derived from every recorded bet, admin refill, and casino tax.
 *
 * Baseline is stored in memory only — it is re-established fresh on every
 * server start (including deployments), so a stale baseline can never cause
 * phantom corrections.
 *
 * Expected pool formula (all-time from baseline):
 *   expected = baseline_pool
 *            + (betsTable net) - (casinoBetsTable net)   ← pool-only flow
 *            + sum(money_ledger.amount WHERE eventType = 'admin_refill_pool')
 *            + sum(monthly_tax_logs.tax_amount)
 *
 * If actual pool deviates by more than $0.01 the watchdog logs a warning and
 * writes a corrective update back to the pool, recording it in money_ledger so
 * the adjustment is always auditable.
 */

import { db, poolTable, betsTable, casinoBetsTable, moneyLedgerTable, monthlyTaxLogsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DRIFT_THRESHOLD = 0.01; // $0.01

// Baseline is in-memory only — refreshed on every server restart / deployment.
// Stores the "anchor" values so we only track CHANGES since server start.
let baselinePool: number | null = null;
let baselineBetsNet: number | null = null;
let baselineRefills: number | null = null;
let baselineTaxes: number | null = null;

async function computeComponents(): Promise<{
  actualPool: number;
  betsNet: number;
  totalRefills: number;
  totalTaxes: number;
}> {
  const [poolRow] = await db.select({ totalAmount: poolTable.totalAmount }).from(poolTable).limit(1);
  if (!poolRow) throw new Error("Pool row not found");

  const [betTotals] = await db
    .select({
      totalBets: sql<string>`COALESCE(SUM(${betsTable.betAmount}), 0)`,
      totalPayouts: sql<string>`COALESCE(SUM(${betsTable.payout}), 0)`,
    })
    .from(betsTable);

  const [casinoBetTotals] = await db
    .select({
      totalBets: sql<string>`COALESCE(SUM(${casinoBetsTable.betAmount}), 0)`,
      totalPayouts: sql<string>`COALESCE(SUM(${casinoBetsTable.payout}), 0)`,
    })
    .from(casinoBetsTable);

  const [refillTotals] = await db
    .select({ total: sql<string>`COALESCE(SUM(${moneyLedgerTable.amount}), 0)` })
    .from(moneyLedgerTable)
    .where(sql`${moneyLedgerTable.eventType} = 'admin_refill_pool'`);

  const [taxTotals] = await db
    .select({ total: sql<string>`COALESCE(SUM(${monthlyTaxLogsTable.taxAmount}), 0)` })
    .from(monthlyTaxLogsTable);

  const totalBets = parseFloat(betTotals?.totalBets ?? "0");
  const totalPayouts = parseFloat(betTotals?.totalPayouts ?? "0");
  const totalCasinoBets = parseFloat(casinoBetTotals?.totalBets ?? "0");
  const totalCasinoPayouts = parseFloat(casinoBetTotals?.totalPayouts ?? "0");

  return {
    actualPool: parseFloat(poolRow.totalAmount),
    // Pool-only net: subtract casino bets since they also write to betsTable but never touch the pool
    betsNet: (totalBets - totalPayouts) - (totalCasinoBets - totalCasinoPayouts),
    totalRefills: parseFloat(refillTotals?.total ?? "0"),
    totalTaxes: parseFloat(taxTotals?.total ?? "0"),
  };
}

export async function runWatchdog(): Promise<void> {
  try {
    const { actualPool, betsNet, totalRefills, totalTaxes } = await computeComponents();

    // --- Establish in-memory baseline on first run ---
    if (baselinePool === null) {
      baselinePool = actualPool;
      baselineBetsNet = betsNet;
      baselineRefills = totalRefills;
      baselineTaxes = totalTaxes;
      logger.info({ baselinePool: baselinePool.toFixed(2), actualPool }, "Watchdog: in-memory baseline established");
      return;
    }

    // Expected pool = baseline + changes since baseline
    const betsNetSince = betsNet - baselineBetsNet!;
    const refillsSince = totalRefills - baselineRefills!;
    const taxesSince = totalTaxes - baselineTaxes!;
    const expectedPool = baselinePool + betsNetSince + refillsSince + taxesSince;
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
        betsNetSince,
        refillsSince,
        taxesSince,
        baselinePool,
      },
      "Watchdog: pool drift detected — auto-correcting"
    );

    // Auto-correct: set pool to expected value and log the correction
    const [freshPool] = await db.select().from(poolTable).limit(1);
    if (!freshPool) return;
    await db.transaction(async (tx) => {
      await tx
        .update(poolTable)
        .set({ totalAmount: expectedPool.toFixed(2) })
        .where(sql`id = ${freshPool.id}`);

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

/** Reset the in-memory baseline — useful after intentional admin pool adjustments. */
export function resetWatchdogBaseline(): void {
  baselinePool = null;
  baselineBetsNet = null;
  baselineRefills = null;
  baselineTaxes = null;
  logger.info("Watchdog: baseline manually reset — will re-establish on next tick");
}

export function startWatchdog(): void {
  // Run immediately on start, then every 60 seconds
  setTimeout(async () => {
    await runWatchdog();
    setInterval(runWatchdog, 60_000);
  }, 5_000); // 5-second delay after server boot so DB is ready

  logger.info("Transaction watchdog started (60s interval)");
}
