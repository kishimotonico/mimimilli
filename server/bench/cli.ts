export function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    i++;
  }
  return args;
}

export function requireArg(args: Map<string, string | true>, key: string): string {
  const value = args.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`--${key} を指定してください`);
  }
  return value;
}

export function optionalArg(args: Map<string, string | true>, key: string): string | undefined {
  const value = args.get(key);
  return typeof value === "string" ? value : undefined;
}

export function optionalIntArg(
  args: Map<string, string | true>,
  key: string,
  fallback: number,
): number {
  const raw = optionalArg(args, key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${key} には非負の整数を指定してください`);
  }
  return parsed;
}
