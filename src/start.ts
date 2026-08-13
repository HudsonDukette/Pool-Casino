import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { initializeFakePlayers, startAutomatedBetting } from "./lib/fake-players.service";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Initialize fake players and automated betting on server start
let fakePlayersInitialized = false;

async function initializeFakePlayerSystem() {
  if (fakePlayersInitialized) return;
  
  try {
    console.log("Initializing fake player system...");
    await initializeFakePlayers(15); // Target 15 fake players
    
    // Start automated betting with random intervals (3-8 minutes)
    const randomInterval = Math.floor(Math.random() * 5) + 3;
    startAutomatedBetting(randomInterval);
    
    fakePlayersInitialized = true;
    console.log(`Fake player system initialized with ${randomInterval} minute betting intervals`);
  } catch (error) {
    console.error("Failed to initialize fake player system:", error);
  }
}

// Initialize on first request after a short delay
let initScheduled = false;

const fakePlayerMiddleware = createMiddleware().server(async ({ next }) => {
  if (!initScheduled) {
    initScheduled = true;
    // Delay initialization to avoid blocking startup
    setTimeout(() => {
      initializeFakePlayerSystem();
    }, 5000);
  }
  return await next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, fakePlayerMiddleware],
}));
