import React, { useState, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, UserPlus, Check, X, Bell, BellOff,
  ChevronRight, Crown, Hash, Globe, Users, RefreshCw, Banknote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL;

async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function Avatar({ username, avatarUrl, size = 8 }: { username?: string; avatarUrl?: string | null; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (avatarUrl) return <img src={avatarUrl} className={`${s} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary`}>
      {username?.charAt(0).toUpperCase() ?? "?"}
    </div>
  );
}

interface FriendRequest {
  id: number;
  from: { id: number; username: string; avatarUrl: string | null } | null;
  createdAt: string;
}

interface UnreadRoom {
  id: number;
  name: string;
  type: string;
  unreadCount: number;
  otherUser: { id: number; username: string; avatarUrl: string | null } | null;
  lastMessage: { content: string; username: string | null; createdAt: string } | null;
}

export default function Notifications() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [unreadRooms, setUnreadRooms] = useState<UnreadRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [friendsData, roomsData] = await Promise.all([
        apiFetch("api/friends"),
        apiFetch("api/chat/rooms"),
      ]);
      setFriendRequests(friendsData.incoming ?? []);
      setUnreadRooms((roomsData.rooms ?? []).filter((r: UnreadRoom) => r.unreadCount > 0));
    } catch {}
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id: number) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiFetch(`api/friends/${id}/accept`, { method: "POST" });
      toast({ title: "Friend added!", className: "bg-success text-success-foreground border-none" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const decline = async (id: number) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiFetch(`api/friends/${id}/decline`, { method: "POST" });
      load();
    } catch {} finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const openRoom = async (room: UnreadRoom) => {
    try {
      await apiFetch(`api/chat/rooms/${room.id}/read`, { method: "POST" });
    } catch {}
    navigate("/chat");
  };

  const total = friendRequests.length + unreadRooms.length;

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div className="space-y-4">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">Please log in to see notifications.</p>
          <Button onClick={() => navigate("/login")}>Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            Notifications
            {total > 0 && (
              <span className="bg-primary text-black text-sm font-bold rounded-full px-2.5 py-0.5">
                {total}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Friend requests and unread messages</p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <BellOff className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">You're all caught up!</p>
          <p className="text-sm text-muted-foreground/60">No pending friend requests or unread messages.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" />
                Friend Requests
                <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {friendRequests.length}
                </span>
              </h2>
              <div className="space-y-2">
                {friendRequests.map(req => (
                  <div key={req.id}
                    className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-4 hover:bg-primary/10 transition-colors">
                    <Avatar username={req.from?.username} avatarUrl={req.from?.avatarUrl} size={10} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{req.from?.username ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => accept(req.id)}
                        disabled={processingIds.has(req.id)}
                        className="bg-primary hover:bg-primary/80 text-black gap-1.5 font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => decline(req.id)}
                        disabled={processingIds.has(req.id)}
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unread Messages Section */}
          {unreadRooms.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Unread Messages
                <span className="bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {unreadRooms.reduce((sum, r) => sum + r.unreadCount, 0)}
                </span>
              </h2>
              <div className="space-y-2">
                {unreadRooms.map(room => {
                  const isDm = room.type === "dm";
                  const displayName = isDm ? (room.otherUser?.username ?? "DM") : room.name;
                  const RoomIcon = room.type === "general" ? Globe : room.type === "group" ? Users : Hash;

                  return (
                    <button
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className="w-full flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                    >
                      <div className="relative flex-shrink-0">
                        {isDm ? (
                          <Avatar username={room.otherUser?.username} avatarUrl={room.otherUser?.avatarUrl} size={10} />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            room.type === "general" ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/10 border-white/10 text-muted-foreground"
                          }`}>
                            <RoomIcon className="w-5 h-5" />
                          </div>
                        )}
                        <span className="absolute -top-1 -right-1 bg-primary text-black text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center leading-none">
                          {room.unreadCount > 99 ? "99+" : room.unreadCount}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{displayName}</p>
                          <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 bg-white/5 rounded-full">
                            {room.type === "dm" ? "DM" : room.type}
                          </span>
                        </div>
                        {room.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {room.lastMessage.username ? (
                              <span className="text-foreground/70 font-medium">{room.lastMessage.username}: </span>
                            ) : null}
                            {room.lastMessage.content}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {room.lastMessage ? new Date(room.lastMessage.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
