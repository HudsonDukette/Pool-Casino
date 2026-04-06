import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect, useState } from "react";
import { format, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  const safe = isNaN(num) ? 0 : num;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatNumber(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  const safe = isNaN(num) ? 0 : num;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(safe);
}

export function safeFormat(
  value: string | Date | null | undefined,
  fmt: string,
  fallback = "—",
): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value as string);
  return isValid(d) ? format(d, fmt) : fallback;
}

export function safeLocaleDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? d.toLocaleDateString("en-US", options) : fallback;
}

export function safeLocaleTime(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? d.toLocaleTimeString("en-US", options) : fallback;
}

export function useCasinoId(): number | undefined {
  const [casinoId, setCasinoId] = useState<number | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("casinoId");
    if (raw) {
      const parsed = parseInt(raw);
      if (!isNaN(parsed)) setCasinoId(parsed);
    }
  }, []);
  return casinoId;
}
