// 別クライアントが開始した再設定を、このタブがreconfiguring・409のどちらも観測
// しないまま完了した場合の検知（ADR-0029のcompletedAt契約）を縛る。
import { createElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import RootReconfigurationDriftEffect from "../../src/app/RootReconfigurationDriftEffect";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";

function renderWithSettings(queryClient: QueryClient, onDrift: () => void) {
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(RootReconfigurationDriftEffect, { onDrift }),
    ),
  );
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
}

describe("RootReconfigurationDriftEffect", () => {
  it("初回観測は基準を記録するだけで発火しない", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    const onDrift = vi.fn();

    renderWithSettings(queryClient, onDrift);

    expect(onDrift).not.toHaveBeenCalled();
  });

  it("rootFolderが同じでもcompletedAtだけ変わっていれば離脱側後処理を発火する", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:00:00.000Z" },
    });
    const onDrift = vi.fn();

    renderWithSettings(queryClient, onDrift);
    expect(onDrift).not.toHaveBeenCalled();

    // 別タブが同じrootFolderへ再設定を完了させた体（rootFolderは変わらずcompletedAtだけ進む）。
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:05:00.000Z" },
    });

    await vi.waitFor(() => expect(onDrift).toHaveBeenCalledTimes(1));
  });

  it("reconfiguring中（status!==idle）はスキップし基準を更新しない", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:00:00.000Z" },
    });
    const onDrift = vi.fn();
    renderWithSettings(queryClient, onDrift);

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "running", rootFolder: "/audio/library", progress: null },
    });
    await Promise.resolve();
    expect(onDrift).not.toHaveBeenCalled();

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:10:00.000Z" },
    });
    await vi.waitFor(() => expect(onDrift).toHaveBeenCalledTimes(1));
  });
});
