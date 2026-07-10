// TASK-20: スキャン進捗のリアルタイム表示（useScanProgress フック・ラベル整形）のテスト。
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useScanProgress } from "../../src/features/scan/useScanProgress";
import { formatScanProgressLabel, type ScanProgress } from "../../src/features/scan/model";

class FakeEventSource extends EventTarget {
  url: string;
  closed = false;
  constructor(url: string) {
    super();
    this.url = url;
  }
  close() {
    this.closed = true;
  }
}

const instances: FakeEventSource[] = [];

function installFakeEventSource() {
  instances.length = 0;
  vi.stubGlobal(
    "EventSource",
    vi.fn(function FakeEventSourceConstructor(url: string) {
      const es = new FakeEventSource(url);
      instances.push(es);
      return es;
    }) as unknown as typeof EventSource,
  );
}

function dispatch(es: FakeEventSource, event: string, data: unknown) {
  const messageEvent = new MessageEvent(event, { data: JSON.stringify(data) });
  act(() => {
    es.dispatchEvent(messageEvent);
  });
}

beforeEach(() => {
  installFakeEventSource();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useScanProgress", () => {
  it("active=false のときは接続しない", () => {
    const { result } = renderHook(({ active }) => useScanProgress(active), {
      initialProps: { active: false },
    });
    expect(instances.length).toBe(0);
    expect(result.current).toBeNull();
  });

  it("active=true になると /scan/events へ接続し、progress イベントで状態が更新される", () => {
    const { result, rerender } = renderHook(({ active }) => useScanProgress(active), {
      initialProps: { active: false },
    });

    rerender({ active: true });
    expect(instances.length).toBe(1);
    expect(instances[0]!.url).toMatch(/\/scan\/events$/);
    expect(instances[0]!.closed).toBe(false);

    dispatch(instances[0]!, "progress", {
      type: "progress",
      phase: "registering",
      processed: 3,
      total: 12,
    });

    expect(result.current).toEqual({ phase: "registering", processed: 3, total: 12 });
  });

  it("complete/error イベントは progress 状態を変更しない", () => {
    const { result, rerender } = renderHook(({ active }) => useScanProgress(active), {
      initialProps: { active: false },
    });
    rerender({ active: true });

    dispatch(instances[0]!, "progress", {
      type: "progress",
      phase: "generating",
      processed: 1,
      total: 2,
    });
    expect(result.current).toEqual({ phase: "generating", processed: 1, total: 2 });

    dispatch(instances[0]!, "complete", {
      type: "complete",
      result: { registered: 1, newlyGenerated: 0, errors: 0, missing: 0, newWorkIds: [] },
    });
    // complete はこのフックの状態を変えない（progress のまま据え置き）
    expect(result.current).toEqual({ phase: "generating", processed: 1, total: 2 });
  });

  it("active が false に戻ると接続を閉じて状態をリセットする", () => {
    const { result, rerender } = renderHook(({ active }) => useScanProgress(active), {
      initialProps: { active: false },
    });
    rerender({ active: true });
    dispatch(instances[0]!, "progress", {
      type: "progress",
      phase: "walking",
      processed: 0,
      total: 0,
    });
    expect(result.current).not.toBeNull();

    rerender({ active: false });
    expect(instances[0]!.closed).toBe(true);
    expect(result.current).toBeNull();
  });
});

describe("formatScanProgressLabel", () => {
  it("null のときは null を返す", () => {
    expect(formatScanProgressLabel(null)).toBeNull();
  });

  it("total=0（件数不定）は「フェーズ名...」の形式", () => {
    const progress: ScanProgress = { phase: "walking", processed: 0, total: 0 };
    expect(formatScanProgressLabel(progress)).toBe("フォルダーを走査中...");
  });

  it("total>0 は「フェーズ名 (processed/total)」の形式", () => {
    const progress: ScanProgress = { phase: "registering", processed: 3, total: 12 };
    expect(formatScanProgressLabel(progress)).toBe("作品を登録中 (3/12)");
  });
});
