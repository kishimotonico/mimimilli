// スキャン診断（ID重複）を物理パス単位で引けるようにする。ナビゲーション状態ではなく
// scan機能の横断関心なので useFilesNavigation / useFilesBrowse とは別枠で持つ。

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import type { IdentityConflict } from "@mimimilli/shared";

/** 物理パス → そのパスが含まれるIdentityConflict */
export function useIdentityConflictMap(): Map<string, IdentityConflict> {
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);
  return useMemo(
    () =>
      new Map(
        (diagnosticsQuery.data?.identityConflicts ?? []).flatMap((diagnostic) =>
          diagnostic.paths.map((path) => [path, diagnostic] as const),
        ),
      ),
    [diagnosticsQuery.data],
  );
}

/** 単一パスぶんのID重複だけ欲しい呼び出し側向け（diagnosticsQueryはキャッシュ共有されるため追加リクエストは発生しない） */
export function useIdentityConflictFor(path: string | null): IdentityConflict | null {
  const map = useIdentityConflictMap();
  if (path == null) return null;
  return map.get(path) ?? null;
}
