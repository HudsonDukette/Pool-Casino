import { createServerFn } from "@tanstack/react-start";
import { createSupabasePublicClient } from "./profiles.server";

const NAME_PARTS = [
  "Shadow", "Neon", "Cyber", "Digital", "Quantum", "Cosmic", "Stellar", "Solar", "Lunar", "Mystic",
  "Dragon", "Phoenix", "Titan", "Apex", "Prime", "Elite", "Master", "Legend", "Hero", "Champion",
  "Storm", "Thunder", "Lightning", "Blaze", "Frost", "Ice", "Fire", "Earth", "Wind", "Water",
  "Crystal", "Plasma", "Atomic", "Nuclear", "Quantum", "Void", "Abyss", "Nexus", "Core", "Flux",
  "Spark", "Pulse", "Wave", "Rhythm", "Beat", "Tempo", "Flow", "Stream", "Current", "Surge",
  "Rider", "Walker", "Runner", "Hunter", "Seeker", "Finder", "Keeper", "Guardian", "Protector", "Defender"
];

const SUFFIXES = [
  "X", "Pro", "Master", "King", "Queen", "Lord", "God", "Elite", "Prime", "Alpha",
  "Omega", "Zero", "One", "Two", "Three", "Max", "Ultra", "Mega", "Giga", "Tera",
  "99", "88", "77", "66", "55", "44", "33", "22", "11", "00",
  "420", "69", "1337", "8008", "007", "101", "2024", "2025", "999", "777"
];

const GAME_IDS = [
  "coinflip", "dice", "wheel", "crash", "plinko", "mines", "highlow", "blackjack",
  "roulette", "slots", "doubledice", "ladder", "war", "guess", "pyramid", "target"
];

function generateRandomUsername(): string {
  const numParts = Math.floor(Math.random() * 3) + 3; // 3-5 name parts
  const parts: string[] = [];
  
  for (let i = 0; i < numParts; i++) {
    parts.push(NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)]);
  }
  
  // Add suffix sometimes
  if (Math.random() > 0.5) {
    parts.push(SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
  }
  
  return parts.join("");
}

function generateFakeEmail(username: string): string {
  const domains = ["fake-casino.com", "bot-player.net", "virtual-gambler.io", "ghost-better.xyz"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username.toLowerCase()}@${domain}`;
}

export const generateFakePlayers = createServerFn({ method: "POST" })
  .inputValidator((input: { count?: number }) => input)
  .handler(async ({ data }) => {
    const count = data.count || Math.floor(Math.random() * 91) + 10; // 10-100 players
    const supabase = createSupabasePublicClient();
    
    const players = [];
    
    for (let i = 0; i < count; i++) {
      const username = generateRandomUsername();
      const email = generateFakeEmail(username);
      const initialBalance = Math.floor(Math.random() * 5000) + 1000; // 1000-6000 initial balance
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .insert({
          user_id: `fake_${Date.now()}_${i}`,
          username: username,
          email: email,
          balance: initialBalance,
          is_admin: false,
          is_owner: false,
          is_banned: false,
          is_perma_banned: false,
          is_suspended: false,
        })
        .select()
        .single();
      
      if (!error && profile) {
        players.push(profile);
      }
    }
    
    return { created: players.length, players };
  });

export const simulateFakePlayerBets = createServerFn({ method: "POST" })
  .inputValidator((input: { count?: number }) => input)
  .handler(async ({ data }) => {
    const count = data.count || Math.floor(Math.random() * 50) + 20; // 20-70 bets
    const supabase = createSupabasePublicClient();
    
    // Get fake players
    const { data: fakePlayers, error: playersError } = await supabase
      .from("profiles")
      .select("*")
      .like("user_id", "fake_%")
      .limit(100);
    
    if (playersError || !fakePlayers || fakePlayers.length === 0) {
      return { bets: 0, message: "No fake players found" };
    }
    
    let betsPlaced = 0;
    
    for (let i = 0; i < count; i++) {
      const player = fakePlayers[Math.floor(Math.random() * fakePlayers.length)];
      const game = GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)];
      const betAmount = Math.floor(Math.random() * Math.min(player.balance, 500)) + 10; // 10-500 or balance
      
      if (player.balance < betAmount) continue;
      
      // Simulate bet outcome (simple random for now)
      const won = Math.random() > 0.55; // 45% win rate
      const multiplier = won ? (Math.random() * 2 + 1.5).toFixed(2) : 0;
      const payout = won ? Math.floor(betAmount * parseFloat(multiplier)) : 0;
      
      // Update player balance
      const newBalance = player.balance - betAmount + payout;
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          balance: newBalance,
          games_played: player.games_played + 1,
          total_wins: player.total_wins + (won ? 1 : 0),
          total_losses: player.total_losses + (won ? 0 : 1),
          last_bet_at: new Date().toISOString(),
        })
        .eq("user_id", player.user_id);
      
      if (!updateError) {
        // Record bet
        await supabase
          .from("bets")
          .insert({
            user_id: player.user_id,
            game_type: game,
            bet_amount: betAmount,
            payout: payout,
            result: won ? "win" : "loss",
            multiplier: won ? parseFloat(multiplier) : null,
            metadata: { fake_player: true },
          });
        
        betsPlaced++;
      }
    }
    
    return { bets: betsPlaced };
  });

export const simulateFakeDonations = createServerFn({ method: "POST" })
  .inputValidator((input: { count?: number }) => input)
  .handler(async ({ data }) => {
    const count = data.count || Math.floor(Math.random() * 10) + 1; // 1-10 donations
    const supabase = createSupabasePublicClient();
    
    // Get fake players and real players
    const { data: fakePlayers, error: fakeError } = await supabase
      .from("profiles")
      .select("*")
      .like("user_id", "fake_%")
      .limit(50);
    
    const { data: realPlayers, error: realError } = await supabase
      .from("profiles")
      .select("*")
      .not("user_id", "like", "fake_%")
      .limit(50);
    
    if (fakeError || !fakePlayers || fakePlayers.length === 0) {
      return { donations: 0, message: "No fake players found" };
    }
    
    if (realError || !realPlayers || realPlayers.length === 0) {
      return { donations: 0, message: "No real players found" };
    }
    
    let donationsMade = 0;
    
    for (let i = 0; i < count; i++) {
      const donor = fakePlayers[Math.floor(Math.random() * fakePlayers.length)];
      const recipient = realPlayers[Math.floor(Math.random() * realPlayers.length)];
      const amount = Math.floor(Math.random() * Math.min(donor.balance, 100)) + 10; // 10-100 or balance
      
      if (donor.balance < amount) continue;
      
      const messages = [
        "Good luck!", "Here's a tip", "Enjoy!", "Have fun!", "From a fan",
        "Keep playing!", "You deserve it", "Happy gaming!", "Cheers!", "Nice plays!"
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      // Update balances
      const { error: donorError } = await supabase
        .from("profiles")
        .update({ 
          balance: donor.balance - amount,
          donated_total: donor.donated_total + amount,
        })
        .eq("user_id", donor.user_id);
      
      const { error: recipientError } = await supabase
        .from("profiles")
        .update({ 
          balance: recipient.balance + amount,
          received_total: recipient.received_total + amount,
        })
        .eq("user_id", recipient.user_id);
      
      if (!donorError && !recipientError) {
        // Record donation
        await supabase
          .from("donations")
          .insert({
            from_user_id: donor.user_id,
            to_user_id: recipient.user_id,
            amount: amount,
            message: message,
          });
        
        donationsMade++;
      }
    }
    
    return { donations: donationsMade };
  });