export type AppMode = "library" | "files" | "nowPlaying" | "workDetail";

export function readAppModeFromPathname(pathname: string): AppMode {
  if (pathname === "/files" || pathname.startsWith("/files/")) return "files";
  if (pathname === "/now-playing") return "nowPlaying";
  if (pathname === "/work" || pathname.startsWith("/work/")) return "workDetail";
  return "library";
}
