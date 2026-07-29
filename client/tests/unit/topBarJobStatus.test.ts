import { act, createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import {
  dlsiteBulkActionsAtom,
  dlsiteBulkActiveAtom,
  dlsiteBulkProgressAtom,
} from "../../src/features/dlsite/model/atoms";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { scanJobAtom } from "../../src/features/scan/model/atoms";

function renderTopBar(atomState?: {
  scanJob?: import("@mimimilli/shared").ScanJobSnapshot | null;
  dlsiteActive?: boolean;
  dlsiteProgress?: { processed: number; total: number } | null;
}) {
  const store = createStore();
  store.set(appModeAtom, "library");
  store.set(dlsiteBulkActionsAtom, {
    start: vi.fn(),
    attach: vi.fn(),
    cancel: vi.fn(),
    dismiss: vi.fn(),
  });

  if (atomState?.scanJob !== undefined) {
    store.set(scanJobAtom, atomState.scanJob);
  }
  if (atomState?.dlsiteActive !== undefined) {
    store.set(dlsiteBulkActiveAtom, atomState.dlsiteActive);
  }
  if (atomState?.dlsiteProgress !== undefined) {
    store.set(dlsiteBulkProgressAtom, atomState.dlsiteProgress);
  }

  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(TopBar, {
        notificationBell: createElement("span", { "aria-label": "通知" }),
      }),
    ),
  );
  return store;
}

describe("TopBar のジョブ状態表示", () => {
  it("スキャン実行中は進捗ラベルを表示する", () => {
    renderTopBar({
      scanJob: {
        id: "job-1",
        status: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: null,
        progress: { phase: "registering", processed: 3, total: 12 },
        result: null,
        error: null,
      },
    });

    expect(screen.getByText("作品を登録中 (3/12)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /作品を登録中 \(3\/12\)/ })).toBeInTheDocument();
  });

  it("DLsite 一括取得中は進捗と中止ボタンを表示する", () => {
    renderTopBar({
      dlsiteActive: true,
      dlsiteProgress: { processed: 2, total: 5 },
    });

    expect(screen.getByText("DLsite取得中 (2/5)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中止" })).toBeInTheDocument();
  });

  it("atom 更新で進捗表示が追従する", () => {
    const store = renderTopBar({
      dlsiteActive: true,
      dlsiteProgress: { processed: 1, total: 5 },
    });
    expect(screen.getByText("DLsite取得中 (1/5)")).toBeInTheDocument();

    act(() => {
      store.set(dlsiteBulkProgressAtom, { processed: 4, total: 5 });
    });
    expect(screen.getByText("DLsite取得中 (4/5)")).toBeInTheDocument();
  });
});
