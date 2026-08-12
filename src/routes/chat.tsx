import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/player-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { safeLocaleDate } from "@/lib/utils";
import { Hash, Lock, Plus, Send, UserPlus, UserMinus, Check } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat, Friends & DMs | Pool Casino" },
      {
        name: "description",
        content:
          "Talk in Pool Casino chat rooms, add friends, and send private messages to other players in real time.",
      },
      { property: "og:title", content: "Chat, Friends & DMs | Pool Casino" },
      {
        property: "og:description",
        content: "Real-time Pool Casino chat rooms, friends list and private messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Message = {
  id: string;
  sender_id: string;
  username: string | null;
  avatar_url: string | null;
  body: string;
  created_at: string;
};

type Friend = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  direction: string;
};

type Target = { kind: "room"; id: string; label: string } | { kind: "dm"; id: string; label: string };

function ChatPage() {
  const { user, isAuthenticated, loading } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [target, setTarget] = React.useState<Target | null>(null);
  const [draft, setDraft] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [newRoom, setNewRoom] = React.useState("");
  const [newRoomPrivate, setNewRoomPrivate] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/login" });
  }, [loading, isAuthenticated, navigate]);

  const { data: rooms, refetch: refetchRooms } = useQuery({
    queryKey: ["chat-rooms"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("id, name, slug, is_private")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: friends, refetch: refetchFriends } = useQuery({
    queryKey: ["my-friends"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_friends");
      if (error) throw error;
      return (data ?? []) as Friend[];
    },
  });

  const { data: searchResults } = useQuery({
    queryKey: ["player-search", search],
    enabled: isAuthenticated && search.trim().length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_players", {
        _q: search.trim(),
        _limit: 8,
      });
      if (error) throw error;
      return (data ?? []) as { user_id: string; username: string; avatar_url: string | null }[];
    },
  });

  React.useEffect(() => {
    if (!target && rooms?.length) {
      const first = rooms[0]!;
      setTarget({ kind: "room", id: first.id, label: first.name });
    }
  }, [rooms, target]);

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["chat-messages", target?.kind, target?.id],
    enabled: isAuthenticated && !!target,
    queryFn: async () => {
      if (!target) return [];
      if (target.kind === "room") {
        const { data, error } = await supabase.rpc("room_messages", {
          _room_id: target.id,
          _limit: 100,
        });
        if (error) throw error;
        return (data ?? []) as Message[];
      }
      const { data, error } = await supabase.rpc("dm_messages", {
        _other_user_id: target.id,
        _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // Live updates for the open conversation.
  React.useEffect(() => {
    if (!target) return;
    const channel = supabase
      .channel(`chat-${target.kind}-${target.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => refetchMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [target, refetchMessages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !target || !user) return;
    setDraft("");
    const payload =
      target.kind === "room"
        ? { room_id: target.id, sender_id: user.id, body }
        : { recipient_id: target.id, sender_id: user.id, body };
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) {
      toast({ title: "Message failed", description: error.message, variant: "destructive" });
      return;
    }
    refetchMessages();
  }

  async function createRoom() {
    const name = newRoom.trim();
    if (!name || !user) return;
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const { data, error } = await supabase
      .from("chat_rooms")
      .insert({ name, slug, is_private: newRoomPrivate, created_by: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: "Could not create room", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("chat_room_members").insert({ room_id: data.id, user_id: user.id });
    setNewRoom("");
    refetchRooms();
    setTarget({ kind: "room", id: data.id, label: data.name });
  }

  async function addFriend(id: string) {
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user!.id, addressee_id: id });
    if (error) {
      toast({ title: "Could not send request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Friend request sent" });
    refetchFriends();
  }

  async function acceptFriend(otherId: string) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", otherId)
      .eq("addressee_id", user!.id);
    if (error) {
      toast({ title: "Could not accept", description: error.message, variant: "destructive" });
      return;
    }
    refetchFriends();
  }

  async function removeFriend(otherId: string) {
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${user!.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user!.id})`,
      );
    refetchFriends();
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Casino <span className="text-primary neon-text-primary">Chat</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Rooms, friends and private messages — live at the table.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr_280px]">
          {/* Rooms */}
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl h-fit">
            <CardContent className="p-4 space-y-3">
              <div className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
                Rooms
              </div>
              <div className="space-y-1">
                {(rooms ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setTarget({ kind: "room", id: r.id, label: r.name })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                      target?.kind === "room" && target.id === r.id
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {r.is_private ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-white/5 space-y-2">
                <Input
                  placeholder="New room name"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newRoomPrivate}
                    onChange={(e) => setNewRoomPrivate(e.target.checked)}
                  />
                  Private room
                </label>
                <Button size="sm" className="w-full" onClick={createRoom} disabled={!newRoom.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl flex flex-col min-h-[520px]">
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="px-5 py-3 border-b border-white/5 font-display font-bold">
                {target?.label ?? "Select a conversation"}
              </div>
              <div className="flex-1 overflow-y-auto max-h-[440px] px-5 py-4 space-y-4">
                {!messages?.length ? (
                  <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex items-start gap-3">
                      <PlayerAvatar
                        username={m.username ?? "??"}
                        avatarUrl={m.avatar_url}
                        className="w-8 h-8 rounded-xl"
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          <span className="text-foreground font-medium">{m.username ?? "Player"}</span>{" "}
                          · {safeLocaleDate(m.created_at)}
                        </div>
                        <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="p-4 border-t border-white/5 flex gap-2">
                <Input
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!target}
                />
                <Button type="submit" disabled={!target || !draft.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Friends */}
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl h-fit">
            <CardContent className="p-4 space-y-4">
              <div className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground">
                Friends
              </div>
              <Input
                placeholder="Find players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchResults?.length ? (
                <div className="space-y-1">
                  {searchResults.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-2">
                      <PlayerAvatar
                        username={p.username}
                        avatarUrl={p.avatar_url}
                        className="w-7 h-7 rounded-lg"
                      />
                      <span className="text-sm truncate flex-1">{p.username}</span>
                      <button
                        onClick={() => addFriend(p.user_id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5"
                        aria-label={`Add ${p.username}`}
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-1 pt-2 border-t border-white/5">
                {!friends?.length ? (
                  <p className="text-xs text-muted-foreground">No friends yet.</p>
                ) : (
                  friends.map((f) => (
                    <div key={f.user_id} className="flex items-center gap-2">
                      <PlayerAvatar
                        username={f.username}
                        avatarUrl={f.avatar_url}
                        className="w-7 h-7 rounded-lg"
                      />
                      <button
                        onClick={() =>
                          setTarget({ kind: "dm", id: f.user_id, label: `@${f.username}` })
                        }
                        className="text-sm truncate flex-1 text-left hover:text-primary"
                      >
                        {f.username}
                        {f.status === "pending" ? (
                          <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                            {f.direction}
                          </span>
                        ) : null}
                      </button>
                      {f.status === "pending" && f.direction === "incoming" ? (
                        <button
                          onClick={() => acceptFriend(f.user_id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5"
                          aria-label={`Accept ${f.username}`}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => removeFriend(f.user_id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-white/5"
                        aria-label={`Remove ${f.username}`}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
