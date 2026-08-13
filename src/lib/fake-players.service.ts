import { createClient } from "@supabase/supabase-js";
import { createSupabasePublicClient } from "./profiles.server";

// Diagnostic function to check system status
export async function diagnoseFakePlayerSystem() {
  const diagnostics = {
    hasSupabaseUrl: !!process.env["SUPABASE_URL"],
    hasServiceKey: !!process.env["SUPABASE_SERVICE_ROLE_KEY"],
    hasPublishableKey: !!process.env["SUPABASE_PUBLISHABLE_KEY"],
    serviceKeyPrefix: process.env["SUPABASE_SERVICE_ROLE_KEY"]?.substring(0, 10) + "..." || "none",
    publishableKeyPrefix: process.env["SUPABASE_PUBLISHABLE_KEY"]?.substring(0, 10) + "..." || "none",
    existingFakePlayers: 0,
    profilesTableAccessible: false,
    profilesCount: 0,
    authStatus: "unknown",
    connectionTest: "unknown",
    error: null as string | null,
    details: {} as Record<string, any>,
  };

  try {
    // Test basic Supabase connection
    const supabase = createSupabasePublicClient();
    
    // Simple connection test - try to get session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      diagnostics.authStatus = `error: ${authError.message}`;
    } else {
      diagnostics.authStatus = session ? `authenticated as ${session.user.email}` : "not authenticated";
    }
    diagnostics.details.session = !!session;
    diagnostics.connectionTest = "ok";

    // Only check profiles if we have service role key (for admin operations)
    if (diagnostics.hasServiceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const serviceSupabase = createClient(
        process.env["SUPABASE_URL"]!,
        process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      // Check if profiles table is accessible with service role
      const { data: profiles, error: profilesError, count } = await serviceSupabase
        .from("profiles")
        .select("count", { count: "exact", head: true });
      
      diagnostics.details.profilesError = profilesError?.message || "none";
      diagnostics.details.profilesCount = count;
      
      if (profilesError) {
        diagnostics.error = `Profiles table error (service role): ${profilesError.message} (code: ${profilesError.code})`;
        diagnostics.details.profilesErrorCode = profilesError.code;
      } else {
        diagnostics.profilesTableAccessible = true;
        diagnostics.profilesCount = count || 0;

        // Count existing fake players
        const { data: fakePlayers, error: countError } = await serviceSupabase
          .from("profiles")
          .select("user_id")
          .or("email.ilike", "%.fake-casino.com")
          .or("email.ilike", "%.bot-player.net")
          .or("email.ilike", "%.virtual-gambler.io")
          .or("user_id.like", "fake_%")
          .limit(50);

        diagnostics.details.fakePlayersError = countError?.message || "none";
        
        if (!countError && fakePlayers) {
          diagnostics.existingFakePlayers = fakePlayers.length;
        }
      }
    } else {
      diagnostics.details.rlsNote = "Cannot check profiles table without SUPABASE_SERVICE_ROLE_KEY due to RLS policies";
      diagnostics.error = "SUPABASE_SERVICE_ROLE_KEY is required to access profiles table (RLS policies block public client)";
    }

  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error);
    diagnostics.details.exception = error instanceof Error ? error.stack : String(error);
  }

  return diagnostics;
}

const NAME_PARTS = [
  "Shadow", "Neon", "Cyber", "Digital", "Quantum", "Cosmic", "Stellar", "Solar", "Lunar", "Mystic",
  "Dragon", "Phoenix", "Titan", "Apex", "Prime", "Elite", "Master", "Legend", "Hero", "Champion",
  "Storm", "Thunder", "Lightning", "Blaze", "Frost", "Ice", "Fire", "Earth", "Wind", "Water",
  "Crystal", "Plasma", "Atomic", "Nuclear", "Void", "Abyss", "Nexus", "Core", "Flux", "Spark",
  "Rider", "Walker", "Runner", "Hunter", "Seeker", "Finder", "Keeper", "Guardian", "Protector", "Defender"
];

const SUFFIXES = [
  "X", "Pro", "Master", "King", "Queen", "Lord", "God", "Elite", "Prime", "Alpha",
  "Omega", "Zero", "One", "Two", "Three", "Max", "Ultra", "Mega", "Giga", "Tera",
  "99", "88", "77", "66", "55", "44", "33", "22", "11", "00"
];

const GAME_IDS = [
  "coinflip", "dice", "wheel", "crash", "plinko", "mines", "highlow", "blackjack",
  "roulette", "slots", "doubledice", "ladder", "war", "guess", "pyramid", "target"
];

function generateRandomUsername(): string {
  const numParts = Math.floor(Math.random() * 3) + 2; // 2-4 name parts
  const parts: string[] = [];
  
  for (let i = 0; i < numParts; i++) {
    parts.push(NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)]);
  }
  
  // Add suffix sometimes
  if (Math.random() > 0.6) {
    parts.push(SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
  }
  
  return parts.join("");
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateFakeEmail(username: string): string {
  const domains = ["fake-casino.com", "bot-player.net", "virtual-gambler.io"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username.toLowerCase()}${Math.floor(Math.random() * 1000)}@${domain}`;
}

// Create actual Supabase auth users for fake players
export async function createFakeAuthUsers(count: number = 10) {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  
  console.log("Starting fake user creation:", { count, hasUrl: !!supabaseUrl, hasServiceKey: !!supabaseServiceKey });
  
  if (!supabaseUrl) {
    console.error("SUPABASE_URL not set");
    return { created: 0, users: [], error: "SUPABASE_URL not available" };
  }
  
  if (!supabaseServiceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set - CANNOT create fake players without it");
    return { 
      created: 0, 
      users: [], 
      error: "SUPABASE_SERVICE_ROLE_KEY is required. The profiles table has a foreign key constraint to auth.users, so fake players MUST be real auth accounts. Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables. You can get this from your Supabase project settings under API > service_role (secret)." 
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const createdUsers = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const username = generateRandomUsername();
      const email = generateFakeEmail(username);
      const password = generateRandomPassword();

      console.log(`Creating fake user ${i + 1}/${count}:`, { username, email });

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          is_fake_player: true,
        },
      });

      if (authError) {
        const errorMsg = `Auth error for ${username}: ${authError.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      if (!authData?.user) {
        const errorMsg = `No user data returned for ${username}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      console.log(`Auth user created:`, { id: authData.user.id, username });

      // Create profile
      const initialBalance = Math.floor(Math.random() * 5000) + 1000; // 1000-6000
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: authData.user.id,
          username,
          email,
          balance: initialBalance,
          is_admin: false,
          is_owner: false,
          is_banned: false,
          is_perma_banned: false,
          is_suspended: false,
          games_played: 0,
          total_wins: 0,
          total_losses: 0,
        });

      if (profileError) {
        const errorMsg = `Profile error for ${username}: ${profileError.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        // Clean up auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        continue;
      }

      console.log(`Profile created for ${username} with balance ${initialBalance}`);

      createdUsers.push({
        id: authData.user.id,
        username,
        email,
        balance: initialBalance,
      });

    } catch (error) {
      const errorMsg = `Exception for user ${i + 1}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`Fake user creation complete: ${createdUsers.length}/${count} created`);
  if (errors.length > 0) {
    console.log("Errors encountered:", errors);
  }

  return { created: createdUsers.length, users: createdUsers, errors: errors.length > 0 ? errors : undefined };
}

// Automated betting system for fake players
let bettingInterval: NodeJS.Timeout | null = null;

export function startAutomatedBetting(intervalMinutes: number = 5) {
  if (bettingInterval) {
    console.log("Automated betting already running");
    return;
  }

  console.log(`Starting automated betting every ${intervalMinutes} minutes`);

  bettingInterval = setInterval(async () => {
    try {
      await placeRandomBets();
    } catch (error) {
      console.error("Error in automated betting:", error);
    }
  }, intervalMinutes * 60 * 1000);

  // Place initial bets
  placeRandomBets();
}

export function stopAutomatedBetting() {
  if (bettingInterval) {
    clearInterval(bettingInterval);
    bettingInterval = null;
    console.log("Stopped automated betting");
  }
}

async function placeRandomBets() {
  const supabase = createSupabasePublicClient();

  try {
    // Get fake players - check both email domains and fake_ user_ids
    const { data: fakePlayers, error: playersError } = await supabase
      .from("profiles")
      .select("*")
      .or("email.ilike", "%.fake-casino.com")
      .or("email.ilike", "%.bot-player.net")
      .or("email.ilike", "%.virtual-gambler.io")
      .or("user_id.like", "fake_%")
      .limit(50);

    if (playersError || !fakePlayers || fakePlayers.length === 0) {
      console.log("No fake players found for betting");
      return;
    }

    // Select random subset of players to bet this round
    const numBettors = Math.floor(Math.random() * Math.min(fakePlayers.length, 10)) + 1;
    const shuffledPlayers = [...fakePlayers].sort(() => Math.random() - 0.5);
    const bettors = shuffledPlayers.slice(0, numBettors);

    console.log(`Placing bets for ${bettors.length} fake players`);

    for (const player of bettors) {
      try {
        // Random delay between each player's bet
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

        const game = GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)];
        const betAmount = Math.floor(Math.random() * Math.min(player.balance, 200)) + 10; // 10-200 or balance

        if (player.balance < betAmount) continue;

        // Simulate bet outcome using actual game logic
        const won = Math.random() > 0.52; // 48% win rate (house edge)
        const multiplier = won ? (Math.random() * 3 + 1.2).toFixed(2) : 0;
        const payout = won ? Math.floor(betAmount * parseFloat(multiplier)) : 0;
        const newBalance = player.balance - betAmount + payout;

        // Update player balance
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            balance: newBalance,
            games_played: (player.games_played || 0) + 1,
            total_wins: (player.total_wins || 0) + (won ? 1 : 0),
            total_losses: (player.total_losses || 0) + (won ? 0 : 1),
            last_bet_at: new Date().toISOString(),
          })
          .eq("user_id", player.user_id);

        if (!updateError) {
          // Record bet using proper bet recording
          await supabase
            .from("bets")
            .insert({
              user_id: player.user_id,
              game_type: game,
              bet_amount: betAmount,
              payout: payout,
              result: won ? "win" : "loss",
              multiplier: won ? parseFloat(multiplier) : null,
              metadata: { 
                fake_player: true,
                automated: true,
              },
            });

          console.log(`Fake player ${player.username} bet ${betAmount} on ${game}: ${won ? 'WON' : 'LOST'} ${payout}`);
        }
      } catch (error) {
        console.error(`Error placing bet for player ${player.username}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in placeRandomBets:", error);
  }
}

// Initialize fake players if they don't exist
export async function initializeFakePlayers(targetCount: number = 20) {
  const supabase = createSupabasePublicClient();

  try {
    // Check current fake player count using email domain matching
    const { data: existingPlayers, error: countError } = await supabase
      .from("profiles")
      .select("*")
      .or("email.ilike", "%.fake-casino.com")
      .or("email.ilike", "%.bot-player.net")
      .or("email.ilike", "%.virtual-gambler.io")
      .limit(50);

    if (countError) {
      console.error("Error checking existing fake players:", countError);
      return { created: 0, users: [], error: countError.message };
    }

    const currentCount = existingPlayers?.length || 0;
    const needed = targetCount - currentCount;

    if (needed > 0) {
      console.log(`Creating ${needed} new fake players (current: ${currentCount}, target: ${targetCount})`);
      const result = await createFakeAuthUsers(needed);
      console.log(`Created ${result.created} fake players`);
      if (result.errors) {
        console.log("Errors during creation:", result.errors);
      }
      return { created: result.created, users: result.users, targetCount };
    } else {
      console.log(`Fake players already exist (${currentCount}/${targetCount})`);
      return { created: currentCount, users: existingPlayers || [], targetCount };
    }
  } catch (error) {
    console.error("Error initializing fake players:", error);
    return { created: 0, users: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}