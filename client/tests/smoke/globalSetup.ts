import { acquireSmokeLock } from "./smokeLock.ts";

// --ui と watch はロックを持ち続けて他の smoke を止めてしまうので、取らない。
function holdsSession(): boolean {
  return (
    process.argv.some((arg) => arg === "--ui" || arg.startsWith("--ui-")) ||
    process.env.PWTEST_WATCH !== undefined
  );
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (holdsSession()) return async () => {};

  const abort = new AbortController();
  const onSignal = () => abort.abort();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    return await acquireSmokeLock({ signal: abort.signal });
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}
