export type AppMode = "library" | "files" | "nowPlaying";

export function readAppModeFromPathname(pathname: string): AppMode {
  if (pathname === "/files" || pathname.startsWith("/files/")) return "files";
  if (pathname === "/now-playing") return "nowPlaying";
  return "library";
}
