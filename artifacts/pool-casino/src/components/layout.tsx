import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Coins, LogOut, User as UserIcon, Menu, X, Mail, Dices, Crown, LayoutDashboard, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const logoutMut = useLogout();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logoutMut.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: "/games", label: "Games", icon: <Dices className="w-4 h-4" /> },
    { href: "/leaderboard", label: "Leaderboard", icon: <Crown className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(0,255,170,0.4)] group-hover:shadow-[0_0_25px_rgba(0,255,170,0.6)] transition-all">
                  <Dices className="w-4 h-4 text-black" />
                </div>
                <span className="font-display font-bold text-xl tracking-tight hidden sm:block">
                  Pool<span className="text-primary neon-text-primary">Casino</span>
                </span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              {navLinks.map((link) => {
                const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Email Button */}
            <a
              href="https://mail.google.com/mail/?view=cm&to=hudsoduk@gmail.com&su=I+need+more+money+on+PoolCasino!"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all"
            >
              <Mail className="w-3.5 h-3.5" /> Email me for more money
            </a>

            {/* User Area */}
            <div className="flex items-center gap-4">
              {!isLoading && user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 shadow-inner">
                    <Coins className="w-4 h-4 text-primary" />
                    <span className="font-mono font-semibold text-primary tracking-tight">
                      {formatCurrency(user.balance)}
                    </span>
                  </div>
                  <Link href="/profile">
                    <Button variant="ghost" size="icon" className="rounded-full bg-white/5 border border-white/10 overflow-hidden p-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4" />
                      )}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden sm:inline-flex text-muted-foreground hover:text-destructive">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : !isLoading ? (
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" className="hidden sm:inline-flex">Log in</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="default" className="shadow-[0_0_15px_rgba(0,255,170,0.3)]">Sign up</Button>
                  </Link>
                </div>
              ) : (
                <div className="w-24 h-8 animate-pulse bg-white/5 rounded-full" />
              )}

              {/* Mobile Menu Button */}
              <div className="md:hidden flex items-center">
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-b border-white/5 bg-card/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {user && (
                <div className="px-3 py-3 mb-2 flex items-center justify-between bg-black/40 rounded-xl border border-white/5">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(user.balance)}</span>
                </div>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-3 rounded-xl text-base font-medium ${
                    location === link.href ? "bg-white/10 text-white" : "text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {link.icon}
                    {link.label}
                  </div>
                </Link>
              ))}
              {!user && !isLoading && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Sign up</Button>
                  </Link>
                </div>
              )}
              {user && (
                <Button
                  variant="ghost"
                  className="w-full mt-2 justify-start text-destructive"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 rounded border border-white/20 flex items-center justify-center">
              <Dices className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium">PoolCasino © 2026</span>
          </div>
          <p className="text-xs text-muted-foreground text-center md:text-right max-w-md">
            This is a simulator using fake money. No real money gambling occurs on this site.
          </p>
          <a
            href="mailto:hudsoduk@gmail.com?subject=PoolCasino%20Support%20%2F%20Feedback"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Support &amp; Feedback
          </a>
        </div>
      </footer>
    </div>
  );
}
