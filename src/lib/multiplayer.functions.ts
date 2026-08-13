import { createServerFn } from "@tanstack/react-start";
import { getAuthenticatedUserId, createSupabasePublicClient } from "./profiles.server";

export const createMultiplayerRoom = createServerFn({ method: "POST" }).handler(async (data: { gameId: string; betAmount: number; maxPlayers: number }) => {
  try {
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
    if (profile.balance < data.betAmount) throw new Error("Insufficient balance");

    // Create multiplayer room
    const { data: room, error } = await supabase
      .from("multiplayer_rooms")
      .insert({
        game_id: data.gameId,
        created_by: userId,
        bet_amount: data.betAmount,
        max_players: data.maxPlayers,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating multiplayer room:", error);
      throw new Error("Failed to create room. Please ensure the multiplayer database tables are set up.");
    }

    // Join the room immediately
    const { error: joinError } = await supabase.from("multiplayer_room_players").insert({
      room_id: room.id,
      user_id: userId,
      status: "ready",
    });

    if (joinError) {
      console.error("Error joining room:", joinError);
      throw new Error("Failed to join room");
    }

    return { roomId: room.id, room };
  } catch (error) {
    console.error("createMultiplayerRoom error:", error);
    throw error;
  }
});

export const joinMultiplayerRoom = createServerFn({ method: "POST" }).handler(async (data: { roomId: string }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Get room details
  const { data: room, error: roomError } = await supabase
    .from("multiplayer_rooms")
    .select("*")
    .eq("id", data.roomId)
    .single();

  if (roomError || !room) throw new Error("Room not found");
  if (room.status !== "waiting") throw new Error("Room is not accepting players");
  
  // Check if already in room
  const { data: existingPlayer } = await supabase
    .from("multiplayer_room_players")
    .select("*")
    .eq("room_id", data.roomId)
    .eq("user_id", userId)
    .single();

  if (existingPlayer) throw new Error("Already in this room");

  // Check player count
  const { data: players } = await supabase
    .from("multiplayer_room_players")
    .select("*")
    .eq("room_id", data.roomId);

  if (players && players.length >= room.max_players) throw new Error("Room is full");

  // Check balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!profile || profile.balance < room.bet_amount) throw new Error("Insufficient balance");

  // Join room
  const { error: joinError } = await supabase.from("multiplayer_room_players").insert({
    room_id: data.roomId,
    user_id: userId,
    status: "ready",
  });

  if (joinError) throw joinError;

  return { success: true };
});

export const getMultiplayerRooms = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const supabase = createSupabasePublicClient();

    const { data, error } = await supabase
      .from("multiplayer_rooms")
      .select("*")
      .eq("status", "waiting")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get creator info and players separately
    const roomsWithDetails = await Promise.all(
      (data || []).map(async (room) => {
        const [{ data: creator }, { data: players }] = await Promise.all([
          supabase.from("profiles").select("username, avatar_url").eq("user_id", room.created_by).single(),
          supabase
            .from("multiplayer_room_players")
            .select("user_id, status")
            .eq("room_id", room.id),
        ]);

        // Get player profiles
        const playersWithProfiles = await Promise.all(
          (players || []).map(async (player) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, avatar_url")
              .eq("user_id", player.user_id)
              .single();
            return {
              ...player,
              player: profile || { username: "Unknown", avatar_url: null },
            };
          })
        );

        return {
          ...room,
          creator: creator || { username: "Unknown", avatar_url: null },
          players: playersWithProfiles,
        };
      })
    );

    return roomsWithDetails;
  } catch (error) {
    console.error("Error fetching multiplayer rooms:", error);
    return [];
  }
});

export const getRoomDetails = createServerFn({ method: "GET" }).handler(async (data: { roomId: string }) => {
  try {
    const supabase = createSupabasePublicClient();

    const { data: room, error } = await supabase
      .from("multiplayer_rooms")
      .select("*")
      .eq("id", data.roomId)
      .single();

    if (error || !room) throw error || new Error("Room not found");

    // Get creator info
    const { data: creator } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("user_id", room.created_by)
      .single();

    // Get players
    const { data: players } = await supabase
      .from("multiplayer_room_players")
      .select("user_id, status")
      .eq("room_id", room.id);

    // Get player profiles
    const playersWithProfiles = await Promise.all(
      (players || []).map(async (player) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", player.user_id)
          .single();
        return {
          ...player,
          player: profile || { username: "Unknown", avatar_url: null },
        };
      })
    );

    return {
      ...room,
      creator: creator || { username: "Unknown", avatar_url: null },
      players: playersWithProfiles,
    };
  } catch (error) {
    console.error("Error fetching room details:", error);
    throw error;
  }
});

export const startMultiplayerGame = createServerFn({ method: "POST" }).handler(async (data: { roomId: string }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  // Verify user is room creator
  const { data: room } = await supabase
    .from("multiplayer_rooms")
    .select("*")
    .eq("id", data.roomId)
    .single();

  if (!room) throw new Error("Room not found");
  if (room.created_by !== userId) throw new Error("Only room creator can start the game");

  // Update room status
  const { error } = await supabase
    .from("multiplayer_rooms")
    .update({ status: "playing" })
    .eq("id", data.roomId);

  if (error) throw error;

  return { success: true };
});

export const leaveMultiplayerRoom = createServerFn({ method: "POST" }).handler(async (data: { roomId: string }) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createSupabasePublicClient();

  const { error } = await supabase
    .from("multiplayer_room_players")
    .delete()
    .eq("room_id", data.roomId)
    .eq("user_id", userId);

  if (error) throw error;

  return { success: true };
});