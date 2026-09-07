// TASK-428.11 レビュー指摘の回帰テスト: 「条件0件（妥当）」と「無効なドラフト（rules=null）」の
// queryKeyが衝突し、無効な間も直前の妥当な件数が表示され続けるバグを固定する。
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { SmartFolderRule } from "@mimimilli/shared";
import { useSmartFolderRuleMatchCountQuery } from "../../src/features/library/model/useLibraryQueries";
import * as smartFolderApi from "../../src/entities/smart-folder/api";

function renderCount(rules: SmartFolderRule[] | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    ({ rules }: { rules: SmartFolderRule[] | null }) =>
      useSmartFolderRuleMatchCountQuery(rules, { immediate: true }),
    { wrapper, initialProps: { rules } },
  );
}

describe("useSmartFolderRuleMatchCountQuery", () => {
  it("条件0件で件数を取得した後、無効なドラフトへ切り替えると古い件数を表示しない", async () => {
    vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount").mockResolvedValue(42);
    const { result, rerender } = renderCount([]);

    await waitFor(() => expect(result.current.total).toBe(42));

    rerender({ rules: null });

    await waitFor(() => expect(result.current.total).toBeUndefined());
    expect(result.current.isCounting).toBe(false);
  });
});
