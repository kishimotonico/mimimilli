import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { createElement } from "react";
import type { SmartFolder } from "@mimimilli/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SmartFolderView } from "../../src/features/library/ui/preview/SmartFolderView";
import * as smartFolderApi from "../../src/entities/smart-folder/api";

afterEach(cleanup);

const smartFolder: SmartFolder = {
  id: "sf-1",
  name: "テストフォルダ",
  rules: [],
  sort: "added-desc",
  createdAt: "2026-07-10T00:00:00.000Z",
};

const lengthFolder: SmartFolder = {
  ...smartFolder,
  rules: [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: [String(99 * 3600 + 30 * 60)] },
  ],
};

function renderView(sf: SmartFolder, total?: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SmartFolderView, { sf, total, onEdit: () => {} }),
    ),
  );
}

describe("SmartFolderView の件数表示", () => {
  beforeEach(() => {
    // 条件一致件数はライブ件数プレビューAPI（TASK-428.11）を叩く。テストでは固定値を返す
    vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount").mockResolvedValue(120);
  });

  it("条件一致と絞り込み後の件数を分けて表示する", async () => {
    renderView(smartFolder, 120);

    await waitFor(() => expect(screen.getByText(/条件一致/)).toHaveTextContent("条件一致 120件"));
    expect(screen.getByText(/絞り込み後/)).toHaveTextContent("絞り込み後 120件");
  });

  it("totalが未確定のときは絞り込み後の件数を描画しない", () => {
    renderView(smartFolder);

    expect(screen.queryByText(/絞り込み後/)).toBeNull();
  });

  it("条件一致件数の取得中は「集計中…」を表示する", () => {
    renderView(smartFolder, 0);

    expect(screen.getByText(/集計中/)).toBeInTheDocument();
  });

  it("totalが0のときは0件絞り込み後と表示する", async () => {
    renderView(smartFolder, 0);

    await waitFor(() => expect(screen.getByText(/絞り込み後/)).toHaveTextContent("絞り込み後 0件"));
  });
});

describe("SmartFolderView の長さ条件表示（TASK-428.11 formatter統一）", () => {
  beforeEach(() => {
    vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount").mockResolvedValue(1);
  });

  it("長さ条件を「99時間30分以上」の自然文で表示する", () => {
    renderView(lengthFolder, 1);

    expect(screen.getByText("99時間30分以上")).toBeInTheDocument();
  });
});
