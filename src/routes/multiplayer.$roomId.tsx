import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, Play, Crown, DoorOpen, Timer } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getRoomDetails, leaveMultiplayerRoom } from "@/lib/multiplayer.functions";
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

export const Route = createFileRoute("/multiplayer/$roomId")({
  component: MultiplayerRoom,
});

function MultiplayerRoom() {
  const { roomId } = Route.useParams();
  const { user, isAuthenticated } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const getRoomDetailsFn = useServerFn(getRoomDetails);
  const leaveRoomFn = useServerFn(leaveMultiplayerRoom);

  const [countdown, setCountdown] = useState(0);

  const { data: room, refetch } = useQuery({
    queryKey: ["multiplayer-room", roomId],
    queryFn: () => getRoomDetailsFn({ data: { roomId } }),
    refetchInterval: 2000,
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "multiplayer_rooms" },
        (payload) => {
          if (payload.new && (payload.new as any).status === "playing") {
            setCountdown(5);
          }
          refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "multiplayer_room_players" },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, refetch]);

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && room?.status === "playing") {
      // Navigate to game when countdown ends
      navigate({ to: `/multiplayer/${roomId}/game` });
    }
  }, [countdown, room?.status, navigate, roomId]);

  async function handleLeave() {
    try {
      await leaveRoomFn({ data: { roomId } });
      navigate({ to: "/multiplayer" });
    } catch (error) {
      toast({
        title: "Failed to leave room",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  }

  if (!room) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center">
            <p className="text-muted-foreground">Loading room...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isCreator = room.created_by === user?.id;
  const canStart = isCreator && room.players.length >= 2 && room.status === "waiting";
  const isFull = room.players.length >= room.max_players;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/multiplayer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Lobby
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {room.game_id.charAt(0).toUpperCase() + room.game_id.slice(1)} Room
          </h1>
          <p className="text-muted-foreground mt-2">
            Bet: {formatCurrency(room.bet_amount)} · {room.players.length}/{room.max_players} players
          </p>
        </div>

        {/* Countdown Overlay */}
        <AnimatePresence>
          {countdown > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-8xl font-bold text-primary mb-4"
                >
                  {countdown}
                </motion.div>
                <p className="text-xl text-white">Game starting...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Players List */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6">
              <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({room.players.length}/{room.max_players})
              </h2>
              
              <div className="space-y-3">
                {room.players.map((player) => (
                  <motion.div
                    key={player.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      player.user_id === user?.id ? "bg-primary/10 border border-primary/30" : "bg-white/5"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                      {player.player.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{player.player.username || "Anonymous"}</span>
                        {player.user_id === room.created_by && <Crown className="w-4 h-4 text-yellow-500" />}
                        {player.user_id === user?.id && <span className="text-xs text-primary">(You)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {player.status === "ready" ? "✓ Ready" : player.status}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {room.players.length < room.max_players && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Waiting for {room.max_players - room.players.length} more player(s)...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Room Info & Actions */}
          <Card className="bg-black/50 border-white/10">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold mb-4">Room Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Game</span>
                    <span className="font-semibold">{room.game_id.charAt(0).toUpperCase() + room.game_id.slice(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bet Amount</span>
                    <span className="font-semibold">{formatCurrency(room.bet_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Players</span>
                    <span className="font-semibold">{room.max_players}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-semibold ${
                      room.status === "waiting" ? "text-yellow-400" :
                      room.status === "playing" ? "text-green-400" :
                      "text-gray-400"
                    }`}>
                      {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {room.status === "waiting" && (
                  <>
                    {canStart && (
                      <Button
                        onClick={() => {/* Start game logic */}}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                    
                    {!isCreator && (
                      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                        <p className="text-sm text-yellow-400">
                          Waiting for room creator to start the game...
                        </p>
                      </div>
                    )}

                    {!isFull && (
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                        <p className="text-sm text-blue-400">
                          <Users className="w-4 h-4 inline mr-1" />
                          Share this room with friends to fill it faster!
                        </p>
                      </div>
                    )}
                  </>
                )}

                {room.status === "playing" && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-400 flex items-center gap-2">
                      <Timer className="w-4 h-4" />
                      Game in progress...
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={handleLeave}
                  className="w-full border-destructive/30 hover:border-destructive/50 text-destructive"
                >
                  <DoorOpen className="w-4 h-4 mr-2" />
                  Leave Room
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}