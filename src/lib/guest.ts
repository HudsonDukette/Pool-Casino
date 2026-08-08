// Local-only guest wallet. Guests get 500 free tokens until they sign in.
export const GUEST_STARTING_BALANCE = 500;

const STORAGE_KEY = "poolcasino.guest.v1";
const EVENT = "poolcasino:guest-updated";

export type GuestState = {
  username: string;
  balance: number;
  createdAt: string;
};

function randomName() {
  return `Guest${Math.floor(1000 + Math.random() * 9000)}`;
}

function fresh(): GuestState {
  return {
    username: randomName(),
    balance: GUEST_STARTING_BALANCE,
    createdAt: new Date().toISOString(),
  };
}

export function readGuest(): GuestState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestState>;
    if (typeof parsed.balance !== "number" || typeof parsed.username !== "string") return null;
    return {
      username: parsed.username,
      balance: parsed.balance,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function write(state: GuestState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function ensureGuest(): GuestState {
  const existing = readGuest();
  if (existing) return existing;
  const created = fresh();
  write(created);
  return created;
}

export function setGuestBalance(balance: number): GuestState {
  const state = ensureGuest();
  const next = { ...state, balance: Math.max(0, Math.round(balance * 100) / 100) };
  write(next);
  return next;
}

export function resetGuest(): GuestState {
  const next = fresh();
  write(next);
  return next;
}

export function clearGuest() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeGuest(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
