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
import { z } from "zod";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import NavigationHistorySync from "../../src/features/navigation/ui/NavigationHistorySync";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { getParsed } from "../../src/shared/api/http";
import { useRootReconfiguringApiErrorHandler } from "../../src/app/model/useRootReconfiguringApiErrorHandler";
import type { Settings } from "@mimimilli/shared";
import { apiError, mockApi } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { buildSettings } from "../helpers/builders";

function settingsOf(
  rootReconfiguration: Settings["rootReconfiguration"],
  lastScanTime: string | null = "2026-01-01T00:00:00.000Z",
): Settings {
  return buildSettings({ rootFolder: "/audio/library", lastScanTime, rootReconfiguration });
}

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

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => playerActionsStub,
}));

// Providers.tsxは通さず手組みするため、409購読（useRootReconfiguringApiErrorHandler）は
// 既定では配線しない。実際の409を模す個別のテストでだけwithApiErrorHandlerを立てる。
function ApiErrorSubscriber({ client }: { client: QueryClient }) {
  useRootReconfiguringApiErrorHandler(client);
  return null;
}

function renderAppWithSettings(
  settings: Settings,
  options: { withApiErrorHandler?: boolean } = {},
) {
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
          options.withApiErrorHandler ? createElement(ApiErrorSubscriber, { client }) : null,
          createElement(DlsiteBulkRuntime),
          createElement(NavigationHistorySync),
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
  mockApi(appShellRoutes());
});

describe("root再設定に入ったときの再生停止（自分で開始していない経路）", () => {
  it("409検知等でsettingsが直接runningへ切り替わったときもstopが呼ばれる", async () => {
    const { queryClient } = renderAppWithSettings(
      settingsOf({ status: "idle", completedAt: null }),
    );

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(stopSpy).not.toHaveBeenCalled();

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it("実際の409（root_reconfiguring）を観測後、settings再取得がrunningを返すとstopが呼ばれる", async () => {
    renderAppWithSettings(settingsOf({ status: "idle", completedAt: null }), {
      withApiErrorHandler: true,
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(stopSpy).not.toHaveBeenCalled();

    mockApi(
      appShellRoutes({
        "GET /api/settings": settingsOf({
          status: "running",
          rootFolder: "/audio/library",
          progress: null,
        }),
        "GET /api/works/:id/playback": () => apiError(409, "root_reconfiguring", "再設定中です"),
      }),
    );

    await expect(getParsed(z.object({}), "/works/some-work/playback")).rejects.toThrow();

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it("起動時に既にfailedだった場合もstopが呼ばれる", async () => {
    renderAppWithSettings(
      settingsOf(
        {
          status: "failed",
          rootFolder: "/audio/library",
          message: "ルートフォルダーにアクセスできません",
        },
        null,
      ),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリの再構築に失敗しました")).toBeInTheDocument(),
    );
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
