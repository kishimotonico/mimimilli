import { NotConfiguredError } from "../errors.ts";

/** 設定済みのルートフォルダーを返す。未設定なら NotConfiguredError。real/fixture 両adapterが共有する。 */
export function requireConfiguredRoot(root: string | null | undefined): string {
  if (!root) {
    throw new NotConfiguredError(
      "ルートフォルダーが設定されていません（POST /api/root-reconfiguration で設定してください）",
    );
  }
  return root;
}
