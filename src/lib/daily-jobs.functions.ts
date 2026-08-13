import { createServerFn } from "@tanstack/react-start";
import { generateFakePlayers, simulateFakePlayerBets, simulateFakeDonations } from "./fake-players.functions";

export const runDailyFakePlayerSimulation = createServerFn({ method: "POST" })
  .handler(async () => {
    const results = {
      playersCreated: 0,
      betsPlaced: 0,
      donationsMade: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Generate new fake players (10-100 daily)
      const playersResult = await generateFakePlayers({ data: {} });
      results.playersCreated = playersResult.created;
    } catch (error) {
      console.error("Failed to generate fake players:", error);
    }

    try {
      // Simulate fake player bets throughout the day
      const betsResult = await simulateFakePlayerBets({ data: {} });
      results.betsPlaced = betsResult.bets;
    } catch (error) {
      console.error("Failed to simulate fake bets:", error);
    }

    try {
      // Simulate fake donations occasionally
      if (Math.random() > 0.5) { // 50% chance of donations happening
        const donationsResult = await simulateFakeDonations({ data: {} });
        results.donationsMade = donationsResult.donations;
      }
    } catch (error) {
      console.error("Failed to simulate fake donations:", error);
    }

    return results;
  });