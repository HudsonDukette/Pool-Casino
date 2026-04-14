const DEBUG_KEY = "poolcasino:debug-refresh";

function browserDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;

  const fromStorage = window.localStorage.getItem(DEBUG_KEY);
  if (fromStorage === "1" || fromStorage === "true") return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("debugRefresh") === "1") return true;

  return false;
}

export function refreshDebugEnabled(): boolean {
  return browserDebugEnabled();
}

export function refreshLog(scope: string, message: string, meta?: Record<string, unknown>): void {
  if (!refreshDebugEnabled()) return;
  const stamp = new Date().toISOString();
  if (meta) {
    console.info(`[refresh-debug][${stamp}][${scope}] ${message}`, meta);
    return;
  }
  console.info(`[refresh-debug][${stamp}][${scope}] ${message}`);
}
