export type AppMode = "library" | "files";

export function readAppModeFromPathname(pathname: string): AppMode {
  return pathname === "/files" || pathname.startsWith("/files/") ? "files" : "library";
}
