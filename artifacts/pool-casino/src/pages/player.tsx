import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ShieldAlert, Trophy, Gamepad2, Target, Calendar, Flag, X, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;

const REPORT_REASONS = [
  "Harassment",
  "Cheating / Exploiting",
  "Hate Speech",
  "Spam / Advertising",
  "Impersonation",
  "Other",
];

export default function PlayerProfile() {
  const [, params] = useRoute("/player/:username");
  const username = params?.username;
  const [, navigate] = useLocation();
  const { data: me } = useGetMe({ query: { retry: false } });
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportPending, setReportPending] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`${BASE}api/user/public/${encodeURIComponent(username)}`, { credentials: "include" })
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return; }
        const data = await r.json();
        setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  const handleReport = async () => {
    if (!me) { toast({ title: "Log in to report players", variant: "destructive" }); return; }
    setReportPending(true);
    try {
      const r = await fetch(`${BASE}api/reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId: profile.id, reason: reportReason, details: reportDetails.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      toast({ title: "Report Submitted", description: data.message, className: "bg-success text-success-foreground border-none" });
      setShowReport(false);
      setReportDetails("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setReportPending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (notFound || !profile) return (
    <div className="text-center py-20 space-y-4">
      <h2 className="text-2xl font-bold text-muted-foreground">Player not found</h2>
      <Button variant="outline" onClick={() => navigate("/leaderboard")}>Back to Leaderboard</Button>
    </div>
  );

  const winRate = profile.gamesPlayed > 0 ? ((profile.totalWins / profile.gamesPlayed) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in py-8">
      {/* Profile Header */}
      <Card className="bg-card border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,170,0.04),transparent_70%)]" />
        <CardContent className="p-8 relative">
          <div className="flex items-center gap-6">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.username}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/40 shadow-[0_0_20px_rgba(0,255,170,0.2)]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-background shadow-[0_0_20px_rgba(0,255,170,0.2)]">
                  <span className="text-3xl font-display font-bold text-background">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-display font-bold">{profile.username}</h1>
                {profile.isAdmin && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Admin
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
                <Calendar className="w-3.5 h-3.5" />
                Joined {format(new Date(profile.createdAt), "MMMM yyyy")}
              </p>
            </div>
            {me && me.id !== profile.id && (
              <button
                onClick={() => setShowReport(!showReport)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 border border-white/10 hover:border-red-500/30 px-3 py-2 rounded-lg transition-all"
                title="Report this player"
              >
                <Flag className="w-3.5 h-3.5" /> Report
              </button>
            )}
          </div>

          {/* Report Form */}
          {showReport && (
            <div className="mt-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-400">Report {profile.username}</h3>
                <button onClick={() => setShowReport(false)} className="text-muted-foreground hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason</label>
                <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                  className="w-full bg-black/40 border border-red-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-red-500/50">
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Details (optional)</label>
                <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="w-full bg-black/40 border border-red-500/20 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-red-500/50 resize-none h-20" />
              </div>
              <Button size="sm" disabled={reportPending} onClick={handleReport}
                className="bg-red-600 hover:bg-red-500 text-white font-bold w-full">
                {reportPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Games Played", value: profile.gamesPlayed.toLocaleString(), icon: <Gamepad2 className="w-4 h-4 text-secondary" /> },
          { label: "Win Rate", value: `${winRate}%`, icon: <Target className="w-4 h-4 text-accent" /> },
          { label: "Biggest Win", value: formatCurrency(profile.biggestWin), icon: <Trophy className="w-4 h-4 text-yellow-400" /> },
          { label: "W / L", value: `${profile.totalWins} / ${profile.totalLosses}`, icon: <Trophy className="w-4 h-4 text-primary" /> },
        ].map(s => (
          <Card key={s.label} className="bg-black/40 border-white/5">
            <CardContent className="p-4 text-center space-y-1">
              <div className="flex justify-center">{s.icon}</div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-mono font-bold text-sm">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
