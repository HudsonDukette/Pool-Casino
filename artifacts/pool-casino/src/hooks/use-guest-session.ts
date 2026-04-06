import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

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

export function useGuestSession(isLoggedIn: boolean, isLoading: boolean, location: string) {
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const onAuthPage = AUTH_PATHS.some((p) => location === p || location.startsWith(p + "/"));

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn) return;
    if (onAuthPage) return;
    if (initialized.current) return;

    initialized.current = true;

    const deviceId = getOrCreateDeviceId();

    fetch(`${_apiBase}/api/auth/guest/init`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => {
        if (r.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      })
      .catch(() => {});
  }, [isLoggedIn, isLoading, onAuthPage, queryClient]);
}
