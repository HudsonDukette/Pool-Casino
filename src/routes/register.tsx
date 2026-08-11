import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, Mail, AlertCircle, Tag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { syntheticEmail } from "@/lib/auth-identifier";
import { clearGuest } from "@/lib/guest";
import { Layout } from "@/components/layout";


export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Sign Up — PoolCasino" },
      { name: "description", content: "Create a free PoolCasino account and start with $10,000 play money." },
      { property: "og:title", content: "Sign Up — PoolCasino" },
      { property: "og:description", content: "Create a free PoolCasino account and start with $10,000 play money." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Register,
});

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast({ title: "Google sign-up failed", description: String(result.error), variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    clearGuest();
    toast({ title: "Signed in with Google", description: "Welcome to PoolCasino!" });
    navigate({ to: "/" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      toast({ title: "Username too short", description: "Username must be at least 3 characters.", variant: "destructive" });
      return;
    }
    const usesEmail = email.trim().length > 0;
    const authEmail = usesEmail ? email.trim() : syntheticEmail(username);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: { username }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      return;
    }
    clearGuest();
    if (!data.session) {
      toast({
        title: "Almost there!",
        description: usesEmail
          ? "Check your email to confirm your account, then log in."
          : "Account created — log in with your username.",
        className: "bg-success text-success-foreground border-none",
      });
      navigate({ to: "/login" });
      return;
    }
    toast({
      title: "Account created!",
      description: "Your balance is ready — good luck.",
      className: "bg-success text-success-foreground border-none",
    });
    navigate({ to: "/" });
  };


  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-[100px]" />
          <CardHeader className="space-y-1 pb-8 text-center relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-secondary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,0,255,0.5)]">
              <User className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-3xl font-display font-bold tracking-tight">Join the Pool</CardTitle>
            <CardDescription>Create an account to start playing and claiming rewards</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Username (min 3 chars)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  className="bg-black/50 pl-10"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-black/50 pl-10"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-black/50 pl-10"
                />
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Referral Code (Optional)"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="bg-black/50 pl-10 font-mono tracking-widest"
                />
              </div>

              {referralCode.trim().length > 0 && (
                <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3 flex items-start gap-3">
                  <Tag className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-300 leading-relaxed">
                    Referral code applied! You&apos;ll receive an extra <span className="font-bold text-green-200">$20,000</span> bonus on signup.
                  </p>
                </div>
              )}

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3 mt-2">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary/90 leading-relaxed">
                  New accounts receive a starting balance to play. This is a simulator, no real money is required or awarded.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base mt-4 shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium neon-text-primary">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
