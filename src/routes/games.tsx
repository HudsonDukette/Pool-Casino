import { createFileRoute, Link } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Dices } from "lucide-react";

export const Route = createFileRoute("/games")({
  component: GamesLayout,
});

function GamesLayout() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 pt-8 pb-8"
        >
          <div className="flex items-center justify-center gap-2">
            <Dices className="w-7 h-7 text-primary" />
            <h1 className="text-4xl md:text-5xl font-display font-bold">Casino Games</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            32 solo games. One global pool. Every bet matters.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key="outlet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
}
