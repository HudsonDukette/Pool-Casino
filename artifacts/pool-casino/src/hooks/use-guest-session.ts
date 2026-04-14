import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshLog } from "@/lib/refresh-debug";

const _apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const DEVICE_ID_KEY = "poolcasino_device_id";

const AUTH_PATHS = ["/login", "/register", "/signup"];

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function useGuestSession(
  isLoggedIn: boolean,
  isLoading: boolean,
  location: string,
  authCheckFailed = false,
) {
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const onAuthPage = AUTH_PATHS.some((p) => location === p || location.startsWith(p + "/"));

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn) return;
    if (onAuthPage) return;
    if (authCheckFailed) {
      refreshLog("guest-session", "Skipping guest init because /api/auth/me failed");
      return;
    }
    if (initialized.current) return;

    initialized.current = true;

    const deviceId = getOrCreateDeviceId();
    refreshLog("guest-session", "Initializing guest session", {
      location,
      deviceIdPreview: deviceId.slice(0, 8),
    });

    fetch(`${_apiBase}/api/auth/guest/init`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => {
        if (r.ok) {
          refreshLog("guest-session", "Guest init succeeded; invalidating /api/auth/me");
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          return;
        }
        refreshLog("guest-session", "Guest init failed", { status: r.status });
      })
      .catch((err) => {
        refreshLog("guest-session", "Guest init request errored", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [authCheckFailed, isLoggedIn, isLoading, location, onAuthPage, queryClient]);
}
