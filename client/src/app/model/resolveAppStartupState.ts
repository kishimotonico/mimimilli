/** 起動時の設定取得に基づくアプリの表示状態。 */
export type AppStartupState = "loading" | "error" | "setup-required" | "ready";

export type ResolveAppStartupStateInput = {
  isPending: boolean;
  isError: boolean;
  data: { rootFolder: string | null } | undefined;
};

/** useSettingsQuery の観測値から起動時の表示状態を決める。 */
export function resolveAppStartupState(input: ResolveAppStartupStateInput): AppStartupState {
  if (input.isPending) return "loading";
  if (input.data == null && input.isError) return "error";
  if (input.data?.rootFolder == null) return "setup-required";
  return "ready";
}
