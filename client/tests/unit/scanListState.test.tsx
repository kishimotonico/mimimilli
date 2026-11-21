import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanListStatus } from "../../src/features/scan/model/scanListStatus";
import ScanListState from "../../src/features/scan/ui/scanModal/ScanListState";
import {
  LOADING_DELAY_MS,
  LOADING_MIN_VISIBLE_MS,
  useDisplayedScanListStatus,
} from "../../src/features/scan/ui/scanModal/useDisplayedScanListStatus";

function Harness({ status }: { status: ScanListStatus }) {
  const displayed = useDisplayedScanListStatus(status);
  return (
    <div>
      <ScanListState
        status={displayed}
        emptyMessage="空です"
        onRetry={() => {}}
        table={{ label: "テスト一覧" }}
        heading={<div>見出し</div>}
      >
        <div>一覧</div>
      </ScanListState>
      {displayed === "ready" && <footer>フッター</footer>}
    </div>
  );
}

function renderState(status: ScanListStatus) {
  const view = render(<Harness status={status} />);
  return { setStatus: (s: ScanListStatus) => view.rerender(<Harness status={s} />) };
}

const skeleton = () => document.querySelector(".mll-status-skeleton");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("表示用の一覧 status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("遅延のあいだは見出しも含めて何も描かない", () => {
    renderState("loading");
    advance(LOADING_DELAY_MS - 1);
    expect(screen.queryByText("見出し")).toBeNull();
    expect(screen.queryByText("一覧")).toBeNull();
    expect(skeleton()).toBeNull();
  });

  it("遅延より短く終われば、スケルトンも見出しの空振りも出さずに一覧へ移る", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS - 50);
    setStatus("ready");
    expect(screen.getByText("一覧")).toBeInTheDocument();
    expect(screen.getByText("見出し")).toBeInTheDocument();
    advance(LOADING_MIN_VISIBLE_MS);
    expect(skeleton()).toBeNull();
  });

  it("遅延より短く終わって空になるときは、見出しを一度も出さない", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS - 50);
    setStatus("empty");
    expect(screen.getByText("空です")).toBeInTheDocument();
    expect(screen.queryByText("見出し")).toBeNull();
    advance(LOADING_MIN_VISIBLE_MS);
    expect(screen.queryByText("見出し")).toBeNull();
  });

  it("遅延のぎりぎりで終わったときは、タイマーが満ちてもスケルトンを出さない", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS - 1);
    setStatus("ready");
    advance(1);
    expect(skeleton()).toBeNull();
    expect(screen.getByText("一覧")).toBeInTheDocument();
  });

  it("遅延を超えるとスケルトンと見出しを出し、出始めから最低時間が経つまで一覧に移らない", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS);
    expect(skeleton()).not.toBeNull();
    expect(screen.getByText("見出し")).toBeInTheDocument();

    advance(50);
    setStatus("ready");
    advance(LOADING_MIN_VISIBLE_MS - 50 - 1);
    expect(skeleton()).not.toBeNull();
    expect(screen.queryByText("一覧")).toBeNull();
    expect(screen.queryByText("フッター")).toBeNull();
    expect(screen.getByText("見出し")).toBeInTheDocument();

    advance(1);
    expect(skeleton()).toBeNull();
    expect(screen.getByText("一覧")).toBeInTheDocument();
    expect(screen.getByText("フッター")).toBeInTheDocument();
  });

  it("最低時間のあいだに空になっても、最低時間までスケルトンを保つ", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS + 100);
    setStatus("empty");
    expect(skeleton()).not.toBeNull();
    advance(LOADING_MIN_VISIBLE_MS - 100);
    expect(skeleton()).toBeNull();
    expect(screen.getByText("空です")).toBeInTheDocument();
    expect(screen.queryByText("見出し")).toBeNull();
  });

  it("最低時間を過ぎてから終われば、すぐ一覧に切り替える", () => {
    const { setStatus } = renderState("loading");
    advance(LOADING_DELAY_MS + LOADING_MIN_VISIBLE_MS + 100);
    expect(skeleton()).not.toBeNull();
    setStatus("ready");
    advance(0);
    expect(skeleton()).toBeNull();
    expect(screen.getByText("一覧")).toBeInTheDocument();
  });

  it("loading が続くあいだはスケルトンと見出しを出し続け、ready 以外の帯は出さない", () => {
    renderState("loading");
    advance(10_000);
    expect(skeleton()).not.toBeNull();
    expect(screen.getByText("見出し")).toBeInTheDocument();
    expect(screen.queryByText("一覧")).toBeNull();
    expect(screen.queryByText("フッター")).toBeNull();
  });

  it("ready の一覧だけが table で、error と empty は見出しも table も出さない", () => {
    const { setStatus } = renderState("ready");
    expect(screen.getByRole("table", { name: "テスト一覧" })).toBeInTheDocument();
    setStatus("error");
    expect(screen.getByText("読み込みに失敗しました")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("見出し")).toBeNull();
    setStatus("empty");
    expect(screen.getByText("空です")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
