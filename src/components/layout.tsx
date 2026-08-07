import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, safeLocaleDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Coins,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Dices,
  Crown,
  LayoutDashboard,
  MessageSquare,
  ShieldAlert,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mock global pool state until the backend schema is wired.
 * This will be replaced with a live server function in the next phase.
 */
const MOCK_POOL = {
  totalAmount: 128456.78,
  biggestBet: 15000,
  biggestWin: 74200,
  forceReloadAt: 0,
};

const navLinks = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: "/chat", label: "Chat", icon: <MessageSquare className="w-4 h-4" /> },
  { to: "/leaderboard", label: "Leaderboards", icon: <Crown className="w-4 h-4" /> },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const state = useRouterState();
  const location = state.location.pathname;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [gamesDropdownOpen, setGamesDropdownOpen] = React.useState(false);
  const gamesDropdownRef = React.useRef<HTMLDivElement>(null);
  const [user, setUser] = React.useState<any>(null);
  const [loadingUser, setLoadingUser] = React.useState(true);

  const pool = MOCK_POOL;

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email, balance: 1000, isGuest: false, isAdmin: false, username: data.user.user_metadata?.username ?? data.user.email } : null);
      setLoadingUser(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email, balance: 1000, isGuest: false, isAdmin: false, username: session.user.user_metadata?.username ?? session.user.email } : null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        gamesDropdownRef.current &&
        !gamesDropdownRef.current.contains(e.target as Node)
      ) {
        setGamesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    toast({ title: "Logged out", variant: "default" });
  };

  const isGamesActive =
    location.startsWith("/games") ||
    location === "/multiplayer" ||
    location === "/casinos";

  const isAdmin = user?.isAdmin === true;

  return (
    <div className="bg-background text-foreground flex flex-col min-h-screen overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link
                to="/"
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(0,255,170,0.4)] group-hover:shadow-[0_0_25px_rgba(0,255,170,0.6)] transition-all">
                  <Dices className="w-4 h-4 text-black" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight hidden sm:block">
                  Pool
                  <span className="text-primary neon-text-primary">Casino</span>
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1 items-center">
              {navLinks.slice(0, 1).map((link) => {
                const isActive = location === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}

              {/* Games dropdown */}
              <div ref={gamesDropdownRef} className="relative">
                <button
                  onClick={() => setGamesDropdownOpen((o) => !o)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isGamesActive
                      ? "bg-white/10 text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Dices className="w-4 h-4" />
                  Games
                  <motion.span
                    animate={{ rotate: gamesDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-0.5"
                  >
                    ▼
                  </motion.span>
                </button>
                <AnimatePresence>
                  {gamesDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-2xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-2 space-y-1">
                        <Link
                          to="/games"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          All Games
                        </Link>
                        <Link
                          to="/multiplayer"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Multiplayer
                        </Link>
                        <Link
                          to="/casinos"
                          onClick={() => setGamesDropdownOpen(false)}
                          className="block px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Player Casinos
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navLinks.slice(1).map((link) => {
                const isActive = location === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}

              {isAdmin && (
                <Link
                  to="/admin"
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${location === "/admin" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Admin
                </Link>
              )}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Pool stat */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-white/5">
                <Coins className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Pool</span>
                <span className="text-sm font-mono font-bold text-white">
                  {formatCurrency(pool.totalAmount)}
                </span>
              </div>

              {user ? (
                <div className="hidden sm:flex items-center gap-2">
                  <Link
                    to="/wallet"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <Coins className="w-4 h-4 text-accent" />
                    <span className="text-sm font-mono font-bold text-white">
                      {formatCurrency(user.balance)}
                    </span>
                  </Link>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span className="max-w-[100px] truncate">{user.username}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link to="/login">
                    <Button variant="ghost" size="sm">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm">Sign up</Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${location === link.to ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/games"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Dices className="w-4 h-4" />
                  All Games
                </Link>
                {user ? (
                  <>
                    <Link
                      to="/wallet"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Coins className="w-4 h-4 text-accent" />
                      Wallet
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-white/5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </>
                ) : (
                  <div className="pt-2 flex gap-2">
                    <Link to="/login" className="flex-1">
                      <Button variant="outline" className="w-full">
                        Log in
                      </Button>
                    </Link>
                    <Link to="/register" className="flex-1">
                      <Button className="w-full">Sign up</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-background/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Dices className="w-4 h-4 text-primary" />
            <span className="font-display font-bold text-foreground">
              Pool<span className="text-primary">Casino</span>
            </span>
          </div>
          <p>Play responsibly. Every bet affects the Global Economy.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
