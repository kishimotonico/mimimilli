// root再設定に「自分で開始していない」経路（409検知によるsettings切り替え・起動時に
// 既にrunning/failedだった場合）で入ったときも、再生が止まることを確認する。
// runStartRootReconfiguration経由（自分で開始した202成功）でのstop呼び出しは
// runStartRootReconfiguration.test.tsxで既に縛っている。ここではApp.tsx側の
// reconfiguring突入検知effectがplayer.stop()を呼ぶことを、usePlayerActionsをモックして確認する。
import { createElement, useMemo } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import type { Settings } from "@mimimilli/shared";

const stopSpy = vi.fn();
const playerActionsStub = {
  play: vi.fn(),
  playFile: vi.fn(),
  playWithResume: vi.fn(),
  togglePlay: vi.fn(),
  stop: stopSpy,
  seek: vi.fn(),
  seekRelative: vi.fn(),
  setVolume: vi.fn(),
  setLoop: vi.fn(),
  nextTrack: vi.fn(),
  prevTrack: vi.fn(),
  setTrackIndex: vi.fn(),
  setPlaybackRate: vi.fn(),
  setChannelSwap: vi.fn(),
  setABPoint: vi.fn(),
  setABPointAt: vi.fn(),
  clearABRepeat: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  retryPlayback: vi.fn(),
  dismissError: vi.fn(),
};

vi.mock("../../src/features/player/model/usePlayerActions", () => ({
  usePlayerActions: () => playerActionsStub,
}));

function renderAppWithSettings(settings: Settings) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), settings);

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        null,
        createElement(
          PlayerRuntimeProvider,
          null,
          createElement(DlsiteBulkRuntime),
          createElement(ScanRuntime),
          createElement(App),
        ),
      ),
    );
  }

  render(createElement(Wrapper));
  return { queryClient };
}

beforeEach(() => {
  stopSpy.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    ),
  );
});

describe("root再設定に入ったときの再生停止（自分で開始していない経路）", () => {
  it("409検知等でsettingsが直接runningへ切り替わったときもstopが呼ばれる", async () => {
    const { queryClient } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(stopSpy).not.toHaveBeenCalled();

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: {
        status: "running",
        rootFolder: "/audio/library",
        progress: null,
      },
    });

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it("起動時に既にfailedだった場合もstopが呼ばれる", async () => {
    renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: {
        status: "failed",
        rootFolder: "/audio/library",
        message: "ルートフォルダーにアクセスできません",
      },
    });

    await waitFor(() =>
      expect(screen.getByText("ライブラリの再構築に失敗しました")).toBeInTheDocument(),
    );
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
