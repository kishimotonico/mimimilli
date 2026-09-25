// shared/api/httpのonApiError購読口と、app層（useRootReconfiguringApiErrorHandler）
// でのroot_reconfiguring検知の配線を縛る。TanStack QueryのuseQuery/useMutationを
// 経由しない直接API呼び出し（例: App.handlePlayのprepareWorkPlayback）でも、
// 409 root_reconfiguringを受けたらsettingsクエリが再取得される
// （＝reconfiguring画面へ移れる）ことを確認する。
import { z } from "zod";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../src/app/model/queryClient";
import { useRootReconfiguringApiErrorHandler } from "../../src/app/model/useRootReconfiguringApiErrorHandler";
import { getParsed, onApiError } from "../../src/shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("onApiError（shared/api/http）", () => {
  it("契約形式のエラー応答を受けるたびstatus・codeを通知する", async () => {
    const listener = vi.fn();
    const unsubscribe = onApiError(listener);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "root_reconfiguring", message: "再設定中です" } }, 409),
      ),
    );

    await expect(getParsed(z.object({}), "/anything")).rejects.toThrow();

    expect(listener).toHaveBeenCalledWith({ status: 409, code: "root_reconfiguring" });
    unsubscribe();
    vi.unstubAllGlobals();
  });
});

describe("createQueryClient（app/model/queryClient）", () => {
  it("副作用を持たず、QueryClientを作るだけ", () => {
    expect(createQueryClient()).toBeInstanceOf(QueryClient);
  });
});

describe("useRootReconfiguringApiErrorHandler（app/model）", () => {
  it("TanStack Queryを経由しない直接API呼び出しの409 root_reconfiguringでもsettingsが再取得される", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/settings")) {
          return jsonResponse({
            rootFolder: "/audio/library",
            lastScanTime: null,
            rootReconfiguration: { status: "idle" },
          });
        }
        return jsonResponse(
          { error: { code: "root_reconfiguring", message: "再設定中です" } },
          409,
        );
      }),
    );

    const client = createQueryClient();
    client.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    expect(client.getQueryState(SETTINGS_QUERY_KEYS.all())?.isInvalidated).toBe(false);

    const onRootReconfiguring = vi.fn();
    renderHook(() => useRootReconfiguringApiErrorHandler(client, onRootReconfiguring));

    // TanStack Queryを経由しない直接呼び出し（prepareWorkPlaybackのような呼び出し方を模す）。
    await expect(getParsed(z.object({}), "/works/some-work/playback")).rejects.toThrow();

    await vi.waitFor(() =>
      expect(client.getQueryState(SETTINGS_QUERY_KEYS.all())?.isInvalidated).toBe(true),
    );
    expect(onRootReconfiguring).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("unmountすると購読が外れ、以降のエラーでinvalidate・onRootReconfiguringのどちらも呼ばない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "root_reconfiguring", message: "再設定中です" } }, 409),
      ),
    );

    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const onRootReconfiguring = vi.fn();
    const { unmount } = renderHook(() =>
      useRootReconfiguringApiErrorHandler(client, onRootReconfiguring),
    );
    unmount();

    await expect(getParsed(z.object({}), "/works/some-work/playback")).rejects.toThrow();

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(onRootReconfiguring).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
