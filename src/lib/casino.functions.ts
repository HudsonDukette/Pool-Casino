import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId, createSupabasePublicClient } from "./profiles.server";

export const createPlayerCasino = createServerFn({ method: "POST" }).handler(async (data: { 
  name: string; 
  description: string; 
  theme: string; 
  houseEdge: number; 
  minBet: number; 
  maxBet: number;
  initialBankroll: number;
}) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Check user balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!profile) throw new Error("Profile not found");
  if (profile.balance < data.initialBankroll) throw new Error("Insufficient balance to start casino");

  // Deduct initial bankroll
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance: profile.balance - data.initialBankroll })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  // Create casino
  const { data: casino, error } = await supabase
    .from("player_casinos")
    .insert({
      owner_id: userId,
      name: data.name,
      description: data.description,
      theme: data.theme,
      house_edge: data.houseEdge,
      min_bet: data.minBet,
      max_bet: data.maxBet,
      bankroll: data.initialBankroll,
      status: "active",
      enabled_games: ["coinflip", "dice", "wheel", "crash", "plinko"],
    })
    .select()
    .single();

  if (error) throw error;

  return { success: true, casino };
});

export const getPlayerCasinos = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabasePublicClient();

  const { data, error } = await supabase
    .from("player_casinos")
    .select(`
      *,
      owner:profiles!player_casinos_owner_id_fkey(username, avatar_url)
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
});

export const getPlayerCasinoDetails = createServerFn({ method: "GET" }).handler(async (data: { casinoId: string }) => {
  const supabase = createSupabasePublicClient();

  const { data: casino, error } = await supabase
    .from("player_casinos")
    .select(`
      *,
      owner:profiles!player_casinos_owner_id_fkey(username, avatar_url)
    `)
    .eq("id", data.casinoId)
    .single();

  if (error || !casino) throw error || new Error("Casino not found");

  // Get casino stats
  const { data: bets } = await supabase
    .from("casino_bets")
    .select("*")
    .eq("casino_id", data.casinoId);

  const totalBets = bets?.length || 0;
  const totalWagered = bets?.reduce((sum, bet) => sum + bet.bet_amount, 0) || 0;
  const totalPayout = bets?.reduce((sum, bet) => sum + bet.payout, 0) || 0;
  const casinoProfit = totalWagered - totalPayout;

  return {
    ...casino,
    stats: {
      totalBets,
      totalWagered,
      totalPayout,
      casinoProfit,
    },
  };
});

export const joinPlayerCasino = createServerFn({ method: "POST" }).handler(async (data: { casinoId: string }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Check if already joined
  const { data: existing } = await supabase
    .from("casino_members")
    .select("*")
    .eq("casino_id", data.casinoId)
    .eq("user_id", userId)
    .single();

  if (existing) throw new Error("Already a member of this casino");

  // Join casino
  const { error } = await supabase
    .from("casino_members")
    .insert({
      casino_id: data.casinoId,
      user_id: userId,
      role: "player",
    });

  if (error) throw error;

  return { success: true };
});

export const leavePlayerCasino = createServerFn({ method: "POST" }).handler(async (data: { casinoId: string }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  const { error } = await supabase
    .from("casino_members")
    .delete()
    .eq("casino_id", data.casinoId)
    .eq("user_id", userId);

  if (error) throw error;

  return { success: true };
});

export const placeCasinoBet = createServerFn({ method: "POST" }).handler(async (data: { 
  casinoId: string; 
  gameId: string; 
  option: string; 
  betAmount: number;
}) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Get casino details
  const { data: casino } = await supabase
    .from("player_casinos")
    .select("*")
    .eq("id", data.casinoId)
    .single();

  if (!casino) throw new Error("Casino not found");
  if (casino.status !== "active") throw new Error("Casino is not active");
  if (data.betAmount < casino.min_bet || data.betAmount > casino.max_bet) {
    throw new Error(`Bet must be between ${casino.min_bet} and ${casino.max_bet}`);
  }

  // Check user balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!profile || profile.balance < data.betAmount) throw new Error("Insufficient balance");

  // Check casino bankroll
  if (casino.bankroll < data.betAmount * 2) throw new Error("Casino doesn't have enough bankroll");

  // Calculate outcome with house edge
  const houseEdge = casino.house_edge / 100;
  const winChance = 0.5 - houseEdge;
  const won = Math.random() < winChance;
  const multiplier = won ? (1 / (1 - houseEdge)).toFixed(2) : 0;
  const payout = won ? Math.floor(data.betAmount * parseFloat(multiplier)) : 0;

  // Update user balance
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance: profile.balance - data.betAmount + payout })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  // Update casino bankroll
  const { error: casinoUpdateError } = await supabase
    .from("player_casinos")
    .update({ bankroll: casino.bankroll - payout })
    .eq("id", data.casinoId);

  if (casinoUpdateError) throw casinoUpdateError;

  // Record bet
  const { error: betError } = await supabase
    .from("casino_bets")
    .insert({
      casino_id: data.casinoId,
      user_id: userId,
      game_type: data.gameId,
      option: data.option,
      bet_amount: data.betAmount,
      payout: payout,
      result: won ? "win" : "loss",
      multiplier: won ? parseFloat(multiplier) : null,
    });

  if (betError) throw betError;

  return { 
    success: true, 
    won, 
    payout, 
    newBalance: profile.balance - data.betAmount + payout,
    casinoBankroll: casino.bankroll - payout,
  };
});

export const updateCasinoSettings = createServerFn({ method: "POST" }).handler(async (data: { 
  casinoId: string; 
  settings: {
    name?: string;
    description?: string;
    houseEdge?: number;
    minBet?: number;
    maxBet?: number;
    enabledGames?: string[];
    status?: string;
  };
}) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Verify ownership
  const { data: casino } = await supabase
    .from("player_casinos")
    .select("*")
    .eq("id", data.casinoId)
    .single();

  if (!casino) throw new Error("Casino not found");
  if (casino.owner_id !== userId) throw new Error("Only casino owner can update settings");

  const { error } = await supabase
    .from("player_casinos")
    .update(data.settings)
    .eq("id", data.casinoId);

  if (error) throw error;

  return { success: true };
});

export const fundCasinoBankroll = createServerFn({ method: "POST" }).handler(async (data: { casinoId: string; amount: number }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Verify ownership
  const { data: casino } = await supabase
    .from("player_casinos")
    .select("*")
    .eq("id", data.casinoId)
    .single();

  if (!casino) throw new Error("Casino not found");
  if (casino.owner_id !== userId) throw new Error("Only casino owner can fund bankroll");

  // Check user balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!profile || profile.balance < data.amount) throw new Error("Insufficient balance");

  // Transfer funds
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance: profile.balance - data.amount })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  const { error: casinoError } = await supabase
    .from("player_casinos")
    .update({ bankroll: casino.bankroll + data.amount })
    .eq("id", data.casinoId);

  if (casinoError) throw casinoError;

  return { success: true, newBankroll: casino.bankroll + data.amount };
});

export const withdrawCasinoProfits = createServerFn({ method: "POST" }).handler(async (data: { casinoId: string; amount: number }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Verify ownership
  const { data: casino } = await supabase
    .from("player_casinos")
    .select("*")
    .eq("id", data.casinoId)
    .single();

  if (!casino) throw new Error("Casino not found");
  if (casino.owner_id !== userId) throw new Error("Only casino owner can withdraw profits");

  const availableProfits = casino.bankroll - casino.initial_bankroll;
  if (availableProfits < data.amount) throw new Error("Insufficient profits available");

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!profile) throw new Error("Profile not found");

  // Transfer funds
  const { error: casinoError } = await supabase
    .from("player_casinos")
    .update({ bankroll: casino.bankroll - data.amount })
    .eq("id", data.casinoId);

  if (casinoError) throw casinoError;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ balance: profile.balance + data.amount })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  return { success: true, newBankroll: casino.bankroll - data.amount };
});