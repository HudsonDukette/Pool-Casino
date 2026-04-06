import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

const _apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const GUEST_OPT_OUT_KEY = "poolcasino_guest_opt_out";
const DEVICE_ID_KEY = "poolcasino_device_id";

const AUTH_PAGES = ["/login", "/register", "/signup"];

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function markGuestOptOut() {
  sessionStorage.setItem(GUEST_OPT_OUT_KEY, "1");
}

export function clearGuestOptOut() {
  sessionStorage.removeItem(GUEST_OPT_OUT_KEY);
}

export function useGuestSession(isLoggedIn: boolean, isLoading: boolean) {
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const [location] = useLocation();

  const onAuthPage = AUTH_PAGES.some((p) => location === p || location.startsWith(p + "?"));

  useEffect(() => {
    if (!onAuthPage) {
      clearGuestOptOut();
    }
  }, [onAuthPage]);

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn) return;
    if (initialized.current) return;
    if (onAuthPage) return;
    if (sessionStorage.getItem(GUEST_OPT_OUT_KEY)) return;
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
