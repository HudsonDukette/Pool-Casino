import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId } from "./profiles.server";
import { 
  createFakeAuthUsers, 
  initializeFakePlayers, 
  startAutomatedBetting, 
  stopAutomatedBetting 
} from "./fake-players.service";

// Initialize fake players (creates real auth accounts)
export const initializeFakePlayersSystem = createServerFn({ method: "POST" })
  .inputValidator((input: { targetCount?: number }) => input)
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    const targetCount = data.targetCount || 20;
    const result = await initializeFakePlayers(targetCount);
    
    return result;
  });

// Create additional fake players with real auth accounts
export const createRealFakePlayers = createServerFn({ method: "POST" })
  .inputValidator((input: { count?: number }) => input)
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    const count = data.count || 10;
    const result = await createFakeAuthUsers(count);
    
    return result;
  });

// Start automated betting system
export const startAutomatedBettingSystem = createServerFn({ method: "POST" })
  .inputValidator((input: { intervalMinutes?: number }) => input)
  .handler(async ({ data }) => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    const intervalMinutes = data.intervalMinutes || 5;
    startAutomatedBetting(intervalMinutes);
    
    return { success: true, message: `Started automated betting every ${intervalMinutes} minutes` };
  });

// Stop automated betting system
export const stopAutomatedBettingSystem = createServerFn({ method: "POST" })
  .handler(async () => {
    const userId = await getAuthenticatedUserId();
    if (!userId) throw new Error("Not authenticated");

    stopAutomatedBetting();
    
    return { success: true, message: "Stopped automated betting" };
  });

// Legacy functions for backward compatibility
export const generateFakePlayers = createServerFn({ method: "POST" })
  .inputValidator((input: { count?: number }) => input)
  .handler(async ({ data }) => {
    const count = data.count || 10;
    const result = await createFakeAuthUsers(count);
    return { created: result.created, players: result.users };
  });