import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Plus, Play, Crown, DoorOpen } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  createMultiplayerRoom, 
  joinMultiplayerRoom, 
  getMultiplayerRooms,
  getRoomDetails,
  startMultiplayerGame,
  leaveMultiplayerRoom 
} from "@/lib/multiplayer.functions";
import { useServerFn } from "@tanstack/react-start";

type MultiplayerRoom = {
  id: string;
  game_id: string;
  created_by: string;
  bet_amount: number;
  max_players: number;
  status: string;
  created_at: string;
  creator: { username: string | null; avatar_url: string | null };
  players: Array<{
    user_id: string;
    status: string;
    player: { username: string | null; avatar_url: string | null };
  }>;
};

export const Route = createFileRoute("/multiplayer")({
  head: () => ({
    meta: [
      { title: "Multiplayer Games — PoolCasino" },
      { name: "description", content: "Compete against other players in real-time multiplayer games." },
      { property: "og:title", content: "Multiplayer Games — PoolCasino" },
      { property: "og:description", content: "Compete against other players in real-time multiplayer games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MultiplayerLobby,
});

function MultiplayerLobby() {
  const { user, isAuthenticated } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createRoomFn = useServerFn(createMultiplayerRoom);
  const joinRoomFn = useServerFn(joinMultiplayerRoom);
  const getRoomsFn = useServerFn(getMultiplayerRooms);
  const getRoomDetailsFn = useServerFn(getRoomDetails);
  const startGameFn = useServerFn(startMultiplayerGame);
  const leaveRoomFn = useServerFn(leaveMultiplayerRoom);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState("blackjack");
  const [betAmount, setBetAmount] = useState("10");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [currentRoom, setCurrentRoom] = useState<MultiplayerRoom | null>(null);

  const { data: rooms, refetch: refetchRooms } = useQuery({
    queryKey: ["multiplayer-rooms"],
    queryFn: () => getRoomsFn({}),
    refetchInterval: 5000,
  });

  // Setup realtime subscription for room updates
  useEffect(() => {
    const channel = supabase
      .channel("multiplayer-rooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "multiplayer_rooms" },
        () => refetchRooms()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "multiplayer_room_players" },
        () => refetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchRooms]);

  const bet = Number(betAmount);
  const balance = user?.balance ?? 0;

  async function handleCreateRoom() {
    if (!isAuthenticated) {
      toast({ title: "Please login first", variant: "destructive" });
      return;
    }

    if (bet <= 0 || bet > balance) {
      toast({ title: "Invalid bet amount", variant: "destructive" });
      return;
    }

    try {
      const result = await createRoomFn({
        data: { gameId: selectedGame, betAmount: bet, maxPlayers },
      });
      setShowCreateModal(false);
      setCurrentRoom(result.room as MultiplayerRoom);
      refetchRooms();
    } catch (error) {
      toast({
        title: "Failed to create room",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  async function handleJoinRoom(roomId: string) {
    if (!isAuthenticated) {
      toast({ title: "Please login first", variant: "destructive" });
      return;
    }

    try {
      await joinRoomFn({ data: { roomId } });
      refetchRooms();
      toast({ title: "Joined room successfully" });
    } catch (error) {
      toast({
        title: "Failed to join room",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  async function handleStartGame(roomId: string) {
    try {
      await startGameFn({ data: { roomId } });
      refetchRooms();
      navigate({ to: `/multiplayer/${roomId}` });
    } catch (error) {
      toast({
        title: "Failed to start game",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  async function handleLeaveRoom(roomId: string) {
    try {
      await leaveRoomFn({ data: { roomId } });
      setCurrentRoom(null);
      refetchRooms();
    } catch (error) {
      toast({
        title: "Failed to leave room",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  const games = [
    { id: "blackjack", name: "Multiplayer Blackjack", description: "Compete to get closest to 21" },
    { id: "poker", name: "Texas Hold'em", description: "Classic poker against other players" },
    { id: "roulette", name: "Multiplayer Roulette", description: "All bet on the same wheel spin" },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Multiplayer <span className="text-primary neon-text-primary">Games</span>
          </h1>
          <p className="text-muted-foreground mt-2">Compete against other players in real-time</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {/* Create Room Panel */}
          <Card className="bg-black/50 border-white/10 h-fit">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold mb-4">Create New Room</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Game</label>
                    <select
                      value={selectedGame}
                      onChange={(e) => setSelectedGame(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2"
                    >
                      {games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Bet Amount</label>
                    <Input
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      className="font-mono bg-black/50 border-white/20"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Max Players</label>
                    <select
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2"
                    >
                      {[2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num}>
                          {num} players
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={handleCreateRoom}
                    disabled={!isAuthenticated}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Room
                  </Button>
                </div>
              </div>

              {!isAuthenticated && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Login to create or join multiplayer rooms
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Rooms */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold">Available Rooms</h2>
            
            {!rooms || rooms.length === 0 ? (
              <Card className="bg-black/50 border-white/10">
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active rooms. Create one to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rooms.map((room: MultiplayerRoom) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="bg-black/50 border-white/10 hover:border-white/20 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{room.creator.username || "Anonymous"}</span>
                              <Crown className="w-4 h-4 text-yellow-500" />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{games.find(g => g.id === room.game_id)?.name || room.game_id}</span>
                              <span>{formatCurrency(room.bet_amount)} bet</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {room.players.length}/{room.max_players}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {room.players.some(p => p.user_id === user?.id) ? (
                              <>
                                {room.created_by === user?.id && room.players.length >= 2 && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleStartGame(room.id)}
                                    className="bg-green-600 hover:bg-green-500"
                                  >
                                    <Play className="w-4 h-4 mr-1" />
                                    Start
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLeaveRoom(room.id)}
                                >
                                  <DoorOpen className="w-4 h-4 mr-1" />
                                  Leave
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleJoinRoom(room.id)}
                                disabled={!isAuthenticated || room.players.length >= room.max_players}
                              >
                                <Users className="w-4 h-4 mr-1" />
                                Join
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}