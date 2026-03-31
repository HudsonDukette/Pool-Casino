import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useGetMe } from "@workspace/api-client-react";

export type GameType = "war" | "highlow";

export interface MatchFoundEvent {
  matchId: number;
  gameType: GameType;
  opponent: { userId: number; username: string };
  timeoutSeconds: number;
}

export interface MatchStartEvent {
  matchId: number;
  gameType: GameType;
  finalBet: number;
  totalRounds: number;
  scores: Record<number, number>;
  opponent: { userId: number; username: string };
}

export interface RoundResultEvent {
  round: number;
  total: number;
  result: any;
  scores: Record<number, number>;
}

export interface MatchEndEvent {
  matchId: number;
  winnerId: number | null;
  youWon: boolean;
  reason: string;
  scores: Record<number, number>;
  finalBet: number;
}

interface MultiplayerContextValue {
  socket: Socket | null;
  connected: boolean;
  queued: boolean;
  queueGameType: GameType | null;
  matchFound: MatchFoundEvent | null;
  currentMatch: MatchStartEvent | null;
  lastRound: RoundResultEvent | null;
  matchEnd: MatchEndEvent | null;
  hlFirstRoll: number | null;
  joinQueue: (gameType: GameType) => void;
  leaveQueue: () => void;
  acceptMatch: (matchId: number) => void;
  placeBet: (matchId: number, betAmount: number) => void;
  sendAction: (matchId: number, action: string, payload?: any) => void;
  forfeitMatch: (matchId: number) => void;
  clearMatchEnd: () => void;
  clearMatchFound: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe({ query: { retry: false } });
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queueGameType, setQueueGameType] = useState<GameType | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundEvent | null>(null);
  const [currentMatch, setCurrentMatch] = useState<MatchStartEvent | null>(null);
  const [lastRound, setLastRound] = useState<RoundResultEvent | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEndEvent | null>(null);
  const [hlFirstRoll, setHlFirstRoll] = useState<number | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId || user?.isGuest) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      auth: { userId },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => { setConnected(false); setQueued(false); setQueueGameType(null); });

    socket.on("queue:status", ({ queued: q, gameType }: { queued: boolean; gameType?: GameType }) => {
      setQueued(q);
      setQueueGameType(q && gameType ? gameType : null);
    });

    socket.on("match:found", (data: MatchFoundEvent) => {
      setMatchFound(data);
      setQueued(false);
      setQueueGameType(null);
    });

    socket.on("match:start", (data: MatchStartEvent) => {
      setMatchFound(null);
      setCurrentMatch(data);
      setLastRound(null);
      setMatchEnd(null);
      setHlFirstRoll(null);
    });

    socket.on("match:round", (data: RoundResultEvent) => {
      setLastRound(data);
      setCurrentMatch(prev => prev ? { ...prev, scores: data.scores } : prev);
      setHlFirstRoll(null);
    });

    socket.on("match:end", (data: MatchEndEvent) => {
      setMatchEnd(data);
      setCurrentMatch(null);
    });

    socket.on("highlow:first_roll", ({ roll }: { roll: number }) => {
      setHlFirstRoll(roll);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setQueued(false);
    };
  }, [userId, user?.isGuest]);

  const joinQueue = useCallback((gameType: GameType) => {
    socketRef.current?.emit("queue:join", { gameType });
  }, []);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("queue:leave");
  }, []);

  const acceptMatch = useCallback((matchId: number) => {
    socketRef.current?.emit("match:accept", { matchId });
  }, []);

  const placeBet = useCallback((matchId: number, betAmount: number) => {
    socketRef.current?.emit("match:bet", { matchId, betAmount });
  }, []);

  const sendAction = useCallback((matchId: number, action: string, payload?: any) => {
    socketRef.current?.emit("match:action", { matchId, action, payload });
  }, []);

  const forfeitMatch = useCallback((matchId: number) => {
    socketRef.current?.emit("match:forfeit", { matchId });
  }, []);

  const clearMatchEnd = useCallback(() => setMatchEnd(null), []);
  const clearMatchFound = useCallback(() => setMatchFound(null), []);

  return (
    <MultiplayerContext.Provider value={{
      socket: socketRef.current,
      connected,
      queued,
      queueGameType,
      matchFound,
      currentMatch,
      lastRound,
      matchEnd,
      hlFirstRoll,
      joinQueue,
      leaveQueue,
      acceptMatch,
      placeBet,
      sendAction,
      forfeitMatch,
      clearMatchEnd,
      clearMatchFound,
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error("useMultiplayer must be used within MultiplayerProvider");
  return ctx;
}
