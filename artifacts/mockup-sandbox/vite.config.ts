import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

export default defineConfig(async ({ command }) => {
  const rawPort = process.env.PORT;

  // Provide a sensible default port for local dev/preview and avoid
  // failing the build when PORT isn't set in CI/CD environments.
  const port = rawPort ? Number(rawPort) : 5173;

  if (rawPort && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  // Default base path to root if not provided (avoids build-time failures).
  const basePath = process.env.BASE_PATH ?? "/";

  const plugins: any[] = [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
  ];

  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    plugins.push(
      await import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({
          root: path.resolve(import.meta.dirname, ".."),
        }),
      ),
    );
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
