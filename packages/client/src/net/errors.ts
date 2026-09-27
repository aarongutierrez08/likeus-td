const MAX_ERRORS = 20;
const recent: string[] = [];

/** Keeps the last uncaught errors so a report can carry them. Call once at startup. */
export function captureErrors(onError?: (message: string) => void): void {
  const push = (message: string): void => {
    recent.push(`${new Date().toISOString()} ${message}`);
    if (recent.length > MAX_ERRORS) recent.shift();
    onError?.(message);
  };
  window.addEventListener("error", (e) => push(e.message || String(e.error)));
  window.addEventListener("unhandledrejection", (e) => push(`unhandled rejection: ${String(e.reason)}`));
}

export function recentErrors(): string[] {
  return recent.slice();
}
