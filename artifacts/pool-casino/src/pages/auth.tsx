import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegister, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, Mail, AlertCircle, Tag, Gamepad2, Link2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useCrazyGamesAuth } from "@/hooks/use-crazygames-auth";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMut = useLogin();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isCrazyGames, isAvailable, isLoading: cgLoading, loginWithCrazyGames, showAccountLinkPrompt } = useCrazyGamesAuth();
  const { data: currentUser } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (currentUser && !currentUser.isGuest) setLocation("/");
  }, [currentUser, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMut.mutate(
      { data: { username, password } },
      {
        onSuccess: async () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          toast({ title: "Welcome back!", description: "Successfully logged in." });
          if (isCrazyGames && isAvailable) {
            await showAccountLinkPrompt().catch(() => {});
          }
          setLocation("/");
        },
        onError: (err) => {
          toast({ title: "Login Failed", description: err.error?.error || "Invalid credentials", variant: "destructive" });
        }
      }
    );
  };

  const handleCrazyGamesLogin = async () => {
    try {
      await loginWithCrazyGames();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome!", description: "Logged in via CrazyGames." });
      setLocation("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CrazyGames login failed";
      toast({ title: "Login Failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        <CardHeader className="space-y-1 pb-8 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,255,170,0.5)]">
            <Lock className="w-6 h-6 text-black" />
          </div>
          <CardTitle className="text-3xl font-display font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription>
            {isCrazyGames ? "Sign in with your CrazyGames account" : "Enter your credentials to access the casino"}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          {isCrazyGames ? (
            <>
              <Button
                type="button"
                onClick={handleCrazyGamesLogin}
                disabled={cgLoading || !isAvailable}
                className="w-full h-12 text-base bg-[#00c4ff] hover:bg-[#00b0e6] text-black font-bold shadow-[0_0_20px_rgba(0,196,255,0.3)] hover:shadow-[0_0_30px_rgba(0,196,255,0.5)] transition-all"
              >
                <Gamepad2 className="w-5 h-5 mr-2" />
                {cgLoading ? "Connecting..." : "Login with CrazyGames"}
              </Button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">Have an existing PoolCasino account?</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    placeholder="Username"
                    icon={<User className="w-5 h-5" />}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="bg-black/50"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    icon={<Lock className="w-5 h-5" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-black/50"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={loginMut.isPending}
                  >
                    {loginMut.isPending ? "Signing In..." : "Continue with Existing Account"}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              {isAvailable && (
                <>
                  <Button
                    type="button"
                    onClick={handleCrazyGamesLogin}
                    disabled={cgLoading}
                    className="w-full h-12 text-base bg-[#00c4ff] hover:bg-[#00b0e6] text-black font-bold shadow-[0_0_20px_rgba(0,196,255,0.3)] hover:shadow-[0_0_30px_rgba(0,196,255,0.5)] transition-all"
                  >
                    <Gamepad2 className="w-5 h-5 mr-2" />
                    {cgLoading ? "Connecting..." : "Login with CrazyGames"}
                  </Button>
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                </>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Username"
                  icon={<User className="w-5 h-5" />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-black/50"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  icon={<Lock className="w-5 h-5" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-black/50"
                />
                <Button
                  type="submit"
                  className="w-full h-12 text-base mt-2 shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:shadow-[0_0_30px_rgba(0,255,170,0.4)]"
                  disabled={loginMut.isPending}
                >
                  {loginMut.isPending ? "Authenticating..." : "Sign In"}
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium neon-text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const registerMut = useRegister();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isCrazyGames, isAvailable, isLoading: cgLoading, loginWithCrazyGames } = useCrazyGamesAuth();
  const { data: currentUser } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (currentUser && !currentUser.isGuest) setLocation("/");
  }, [currentUser, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMut.mutate(
      { data: { username, password, email: email || undefined, referralCode: referralCode.trim().toUpperCase() || undefined } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          toast({ title: "Account Created!", description: data.message, className: "bg-success text-success-foreground border-none" });
          setLocation("/");
        },
        onError: (err) => {
          toast({ title: "Registration Failed", description: err.error?.error || "Username might be taken", variant: "destructive" });
        }
      }
    );
  };

  const handleCrazyGamesSignup = async () => {
    try {
      await loginWithCrazyGames();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome!", description: "Account created via CrazyGames." });
      setLocation("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CrazyGames login failed";
      toast({ title: "Signup Failed", description: message, variant: "destructive" });
    }
  };

  if (currentUser && !currentUser.isGuest) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-[100px]" />
        <CardHeader className="space-y-1 pb-8 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-accent to-secondary rounded-xl mx-auto flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,0,255,0.5)]">
            <User className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-display font-bold tracking-tight">Join the Pool</CardTitle>
          <CardDescription>
            {isCrazyGames ? "Create your account using CrazyGames" : "Create an account to start playing and claiming rewards"}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          {isCrazyGames ? (
            <div className="space-y-5">
              <div className="bg-[#00c4ff]/10 border border-[#00c4ff]/30 rounded-xl p-4 flex items-start gap-3">
                <Gamepad2 className="w-5 h-5 text-[#00c4ff] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#00c4ff] mb-1">CrazyGames Platform Detected</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sign up using your CrazyGames account for the best experience. Your account will sync across the platform.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  "Instant signup — no password needed",
                  "Auto-synced with your CrazyGames profile",
                  "Start with $10,000 in play money",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={handleCrazyGamesSignup}
                disabled={cgLoading || !isAvailable}
                className="w-full h-12 text-base bg-[#00c4ff] hover:bg-[#00b0e6] text-black font-bold shadow-[0_0_20px_rgba(0,196,255,0.3)] hover:shadow-[0_0_30px_rgba(0,196,255,0.5)] transition-all"
              >
                <Gamepad2 className="w-5 h-5 mr-2" />
                {cgLoading ? "Connecting..." : "Sign Up with CrazyGames"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">Create a standard account instead</p>
                <Input
                  placeholder="Username (min 3 chars)"
                  icon={<User className="w-5 h-5" />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  className="bg-black/50"
                />
                <Input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  icon={<Lock className="w-5 h-5" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-black/50"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={registerMut.isPending}
                >
                  {registerMut.isPending ? "Creating..." : "Create Standard Account"}
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Username (min 3 chars)"
                icon={<User className="w-5 h-5" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="bg-black/50"
              />
              <Input
                type="email"
                placeholder="Email (Optional)"
                icon={<Mail className="w-5 h-5" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50"
              />
              <Input
                type="password"
                placeholder="Password (min 6 chars)"
                icon={<Lock className="w-5 h-5" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-black/50"
              />
              <Input
                placeholder="Referral Code (Optional)"
                icon={<Tag className="w-5 h-5" />}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="bg-black/50 font-mono tracking-widest"
              />

              {referralCode.trim().length > 0 && (
                <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3 flex items-start gap-3">
                  <Tag className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-300 leading-relaxed">
                    Referral code applied! You'll receive an extra <span className="font-bold text-green-200">$20,000</span> bonus on signup.
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
                disabled={registerMut.isPending}
              >
                {registerMut.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium neon-text-primary">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
