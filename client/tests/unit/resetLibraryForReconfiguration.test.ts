import { QueryClient, QueryClientProvider, QueryObserver, useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  markReconfigurationAffectedQueriesStale,
  removeReconfigurationAffectedQueries,
} from "../../src/app/model/resetLibraryForReconfiguration";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../src/entities/tag/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/entities/scan/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../src/entities/file-system/queryKeys";

const AFFECTED_KEYS = [
  WORK_QUERY_KEYS.list({}),
  WORK_QUERY_KEYS.detail("work-1"),
  WORK_QUERY_KEYS.allFacets(),
  WORK_QUERY_KEYS.dlsiteNotifications(),
  SMART_FOLDER_QUERY_KEYS.all(),
  SMART_FOLDER_QUERY_KEYS.works("folder-1"),
  TAG_QUERY_KEYS.all(),
  TAG_QUERY_KEYS.prefixes(),
  SCAN_QUERY_KEYS.last(),
  SCAN_QUERY_KEYS.candidates(),
  SCAN_QUERY_KEYS.candidateExclusions(),
  SCAN_QUERY_KEYS.diagnostics(),
  FILE_SYSTEM_QUERY_KEYS.directory("dlsite"),
];

describe("removeReconfigurationAffectedQueries", () => {
  it("旧rootに紐づく作品系・候補・fsキャッシュを破棄する", () => {
    const queryClient = new QueryClient();
    for (const queryKey of AFFECTED_KEYS) {
      queryClient.setQueryData(queryKey, { seeded: true });
    }

    removeReconfigurationAffectedQueries(queryClient);

    for (const queryKey of AFFECTED_KEYS) {
      expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    }
  });

  it("settingsクエリなど再設定に無関係なキャッシュは残す", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["settings"], { rootFolder: "/audio/library" });

    removeReconfigurationAffectedQueries(queryClient);

    expect(queryClient.getQueryData(["settings"])).toEqual({ rootFolder: "/audio/library" });
  });

  it("マウント中のuseQuery（＝通常UIのobserver）がいると即座に再フェッチする（＝アンマウント後にしか呼べない理由）", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ seeded: true });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useQuery({ queryKey: WORK_QUERY_KEYS.all(), queryFn }), { wrapper });
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    removeReconfigurationAffectedQueries(queryClient);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});

describe("markReconfigurationAffectedQueriesStale", () => {
  it("生きたobserverがいても即座には再フェッチしない（refetchType:none）", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ seeded: true });
    const observer = new QueryObserver(queryClient, {
      queryKey: WORK_QUERY_KEYS.all(),
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.all())?.fetchStatus).toBe("idle"),
    );
    expect(queryFn).toHaveBeenCalledTimes(1);

    markReconfigurationAffectedQueriesStale(queryClient);
    // マイクロタスクが流れても再フェッチが起きないことを確認する
    await Promise.resolve();
    await Promise.resolve();
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.all())?.isInvalidated).toBe(true);

    unsubscribe();
  });
});
