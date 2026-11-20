import { createElement } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspacePath } from "@mimimilli/shared";
import NeedsAttentionTab, {
  type NeedsAttentionTabProps,
} from "../../src/features/scan/ui/scanModal/NeedsAttentionTab";
import { buildNeedsAttentionRows } from "../../src/features/scan/model/needsAttention";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { apiError, apiNoContent, mockApi } from "../helpers/api";
import { buildScanDiagnostics, buildScanRecord } from "../helpers/builders";

const rows = buildNeedsAttentionRows({
  diagnostics: buildScanDiagnostics({
    identityConflicts: [
      {
        kind: "identity_conflict",
        workId: "RJ501001",
        paths: [workspacePath("dlsite/a"), workspacePath("dlsite/b")],
      },
    ],
    invalidMetaFiles: [
      {
        path: workspacePath("broken/mimimilli.json"),
        message: "mimimilli.json 12行目: カンマが足りない",
      },
    ],
  }),
  record: buildScanRecord({
    unreadablePaths: [workspacePath("locked")],
    dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["work-int"] },
    missingWorks: [
      { workId: "work-miss", title: "消えた作品", previousPath: workspacePath("old/place") },
    ],
  }),
});

function renderTab(overrides: Partial<NeedsAttentionTabProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props: NeedsAttentionTabProps = {
    rows,
    loading: false,
    error: false,
    onRetry: vi.fn(),
    onOpenFiles: vi.fn(),
    onOpenWorkDetail: vi.fn(),
    ...overrides,
  };
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(NeedsAttentionTab, props),
      createElement(GlobalToast, {
        onOpenScan: () => {},
        onOpenScanNeedsAttention: () => {},
        onRetrySkippedTrack: () => {},
      }),
    ),
  );
  return props;
}

function rowOf(kind: string) {
  const cell = screen.getByText(kind, { selector: "[data-tone]" });
  return within(cell.closest("tr")!);
}

describe("NeedsAttentionTab", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("列は種類・対象・起きていること・推奨アクションで、5種類を出しDLsite系は出さない", () => {
    renderTab();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "種類",
      "対象",
      "起きていること",
      "推奨アクション",
    ]);
    for (const kind of ["ID重複", "読み取り失敗", "アクセス不可", "データ不整合", "行方不明"]) {
      expect(screen.getByText(kind, { selector: "[data-tone]" })).toBeInTheDocument();
    }
    expect(screen.queryByText(/RJコード|DLsite/)).toBeNull();
  });

  it("各種類の起きていることと推奨アクションを出す", () => {
    renderTab();
    expect(rowOf("ID重複").getByText("同じ作品IDの作品情報ファイルが複数ある")).toBeInTheDocument();
    expect(
      rowOf("ID重複").getByText("どちらかを消すか、Filesで別の作品として取り込む"),
    ).toBeInTheDocument();
    expect(
      rowOf("読み取り失敗").getByText("mimimilli.json 12行目: カンマが足りない"),
    ).toBeInTheDocument();
    expect(rowOf("読み取り失敗").getByText("ファイルを直す")).toBeInTheDocument();
    expect(rowOf("アクセス不可").getByText("フォルダーを開く権限がない")).toBeInTheDocument();
    expect(rowOf("アクセス不可").getByText("アクセス権を確認")).toBeInTheDocument();
    expect(
      rowOf("データ不整合").getByText("保存データが壊れていて、一覧に出していない"),
    ).toBeInTheDocument();
    expect(rowOf("行方不明").getByText("前回あったフォルダーが見つからない")).toBeInTheDocument();
  });

  it("ID重複の各パス・読み取り失敗・アクセス不可のパスでFilesを開く", async () => {
    const user = userEvent.setup();
    const props = renderTab();
    await user.click(screen.getByRole("button", { name: "dlsite/a" }));
    await user.click(screen.getByRole("button", { name: "dlsite/b" }));
    await user.click(screen.getByRole("button", { name: "broken/mimimilli.json" }));
    await user.click(screen.getByRole("button", { name: "locked" }));
    expect(vi.mocked(props.onOpenFiles).mock.calls.map(([path]) => path)).toEqual([
      "dlsite/a",
      "dlsite/b",
      "broken/mimimilli.json",
      "locked",
    ]);
  });

  it("行方不明のタイトルで作品詳細を開き、旧パスと作品IDはボタンにしない", async () => {
    const user = userEvent.setup();
    const props = renderTab();
    await user.click(screen.getByRole("button", { name: "消えた作品" }));
    expect(props.onOpenWorkDetail).toHaveBeenCalledWith("work-miss");
    expect(screen.getByText("old/place")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "old/place" })).toBeNull();
    expect(screen.getByText("work-int")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "work-int" })).toBeNull();
  });

  it("この作品を読み直すで POST /works/:id/reload を呼ぶ", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "POST /api/works/work-int/reload": apiNoContent(),
      "GET /api/scan/candidates": { candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "この作品を読み直す" }));
    await waitFor(() => expect(api.requestsTo("POST /api/works/work-int/reload")).toHaveLength(1));
  });

  it("読み直しに失敗するとトーストを出し、行は残る", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/works/work-int/reload": apiError(
        409,
        "conflict",
        "作品情報ファイルが壊れています",
      ),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "この作品を読み直す" }));
    expect(
      await screen.findByText(/作品情報ファイルが壊れています|読み直せませんでした/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この作品を読み直す" })).toBeEnabled();
  });

  it("登録を解除は確認を経て DELETE /works/:id を呼ぶ", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "DELETE /api/works/work-miss": apiNoContent(),
      "GET /api/scan/candidates": { candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "登録を解除" }));
    expect(api.requestsTo("DELETE /api/works/work-miss")).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: "解除する" }));
    await waitFor(() => expect(api.requestsTo("DELETE /api/works/work-miss")).toHaveLength(1));
  });

  it("行が無ければ空状態、読み込み中・失敗は状態表示にする", async () => {
    const user = userEvent.setup();
    const empty = renderTab({ rows: [] });
    expect(screen.getByText("要対応の項目はありません")).toBeInTheDocument();
    cleanup();
    const failed = renderTab({ rows: [], error: true });
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(failed.onRetry).toHaveBeenCalledOnce();
    expect(empty.onRetry).not.toHaveBeenCalled();
  });
});
