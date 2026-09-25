// shared/api/httpのonApiError購読口と、app層（queryClient.ts）でのroot_reconfiguring検知の配線を縛る。
// TanStack QueryのuseQuery/useMutationを経由しない直接API呼び出し（例:
// App.handlePlayのprepareWorkPlayback）でも、409 root_reconfiguringを受けたら
// settingsクエリが再取得される（＝reconfiguring画面へ移れる）ことを確認する。
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../src/app/model/queryClient";
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
      rootReconfiguration: { status: "idle" },
    });
    expect(client.getQueryState(SETTINGS_QUERY_KEYS.all())?.isInvalidated).toBe(false);

    // TanStack Queryを経由しない直接呼び出し（prepareWorkPlaybackのような呼び出し方を模す）。
    await expect(getParsed(z.object({}), "/works/some-work/playback")).rejects.toThrow();

    await vi.waitFor(() =>
      expect(client.getQueryState(SETTINGS_QUERY_KEYS.all())?.isInvalidated).toBe(true),
    );

    vi.unstubAllGlobals();
  });

  it("複数回呼んでも古いclientへの購読が残らない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "root_reconfiguring", message: "再設定中です" } }, 409),
      ),
    );

    const first = createQueryClient();
    const firstInvalidate = vi.spyOn(first, "invalidateQueries");

    const second = createQueryClient();
    const secondInvalidate = vi.spyOn(second, "invalidateQueries");

    await expect(getParsed(z.object({}), "/works/some-work/playback")).rejects.toThrow();

    await vi.waitFor(() => expect(secondInvalidate).toHaveBeenCalled());
    expect(firstInvalidate).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
