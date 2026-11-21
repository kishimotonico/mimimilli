import { createElement } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspacePath, type ScanDiagnostics } from "@mimimilli/shared";
import NeedsAttentionTab, {
  type NeedsAttentionTabProps,
} from "../../src/features/scan/ui/scanModal/NeedsAttentionTab";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { apiError, apiNoContent, mockApi } from "../helpers/api";
import {
  buildScanDiagnostics,
  buildScanRecord,
  buildWorkSourceMutationResult,
} from "../helpers/builders";

const diagnostics = buildScanDiagnostics({
  identityConflicts: [
    {
      kind: "identity_conflict",
      registeredTitle: "登録済みの作品",
      registeredPath: workspacePath("dlsite/a"),
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
  unreadablePaths: [workspacePath("locked")],
  dataIntegrityWorks: [{ workId: "work-int", title: "壊れた作品" }],
  missingWorks: [
    { workId: "work-miss", title: "消えた作品", previousPath: workspacePath("old/place") },
  ],
});

function renderTab(
  overrides: Partial<NeedsAttentionTabProps> & { diagnostics?: ScanDiagnostics | null } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  const { diagnostics: seeded = diagnostics, ...tabOverrides } = overrides;
  if (seeded) queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), seeded);
  const props: NeedsAttentionTabProps = {
    onOpenFiles: vi.fn(),
    onOpenWorkDetail: vi.fn(),
    ...tabOverrides,
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
  const cell = screen.getByText(kind, { selector: "[role=cell]" });
  return within(cell.closest<HTMLElement>("[role=row]")!);
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
      expect(screen.getByText(kind, { selector: "[role=cell]" })).toBeInTheDocument();
    }
    expect(screen.queryByText(/RJコード|DLsite/)).toBeNull();
  });

  it("各種類の起きていることと推奨アクションを出す", () => {
    renderTab();
    expect(rowOf("ID重複").getAllByRole("cell")[2]).toHaveTextContent(
      "同じ作品ID RJ501001 の作品情報ファイルが複数ある",
    );
    expect(rowOf("読み取り失敗").getAllByRole("cell")[2]).toHaveTextContent(
      "mimimilli.json 12行目: カンマが足りない",
    );
    expect(rowOf("読み取り失敗").getByText("ファイルを直す")).toBeInTheDocument();
    expect(rowOf("アクセス不可").getByText("フォルダーを開く権限がない")).toBeInTheDocument();
    expect(rowOf("アクセス不可").getByText("アクセス権を確認")).toBeInTheDocument();
    expect(
      rowOf("データ不整合").getByText("保存データが壊れていて、一覧に出していない"),
    ).toBeInTheDocument();
    expect(rowOf("行方不明").getByText("前回あったフォルダーが見つからない")).toBeInTheDocument();
  });

  it("行番号のない診断でも、ファイル名だけを等幅で出して文はそのまま出す", () => {
    renderTab({
      diagnostics: buildScanDiagnostics({
        invalidMetaFiles: [
          {
            path: workspacePath("a/b.mimimilli.json"),
            message: "b.mimimilli.json: 作品ID x が別の作品情報ファイルと重複している",
          },
        ],
      }),
    });
    const cell = rowOf("読み取り失敗").getAllByRole("cell")[2]!;
    expect(cell).toHaveTextContent(
      "b.mimimilli.json: 作品ID x が別の作品情報ファイルと重複している",
    );
    expect(within(cell).getByText("b.mimimilli.json").className).toContain("font-mono");
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

  it("ID重複は登録済みと未登録のラベルをパスと同じ行に並べ、取り込むボタンは推奨アクションの列に置く", () => {
    renderTab();
    const row = rowOf("ID重複");
    const registered = row.getByText("登録済み").parentElement!;
    expect(within(registered).getByRole("button", { name: "dlsite/a" })).toBeVisible();
    const unregistered = row.getByText("未登録").parentElement!;
    expect(within(unregistered).getByRole("button", { name: "dlsite/b" })).toBeVisible();
    expect(row.queryByText("登録済みの作品")).toBeNull();
    expect(row.queryByText("作品ID RJ501001")).toBeNull();
    const importButton = row.getByRole("button", { name: "別の作品として取り込む" });
    const [, targetCell, , actionCell] = row.getAllByRole("cell");
    expect(within(targetCell!).queryByRole("button", { name: /取り込む/ })).toBeNull();
    expect(actionCell).toContainElement(importButton);
  });

  it("未登録パスが複数のID重複は、ボタンが1つで、確認ダイアログには先頭の未登録パスを出す", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/works/identity-conflicts/reassign": buildWorkSourceMutationResult(),
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            registeredTitle: "登録済み",
            registeredPath: workspacePath("reg/a"),
            workId: "w",
            paths: [workspacePath("reg/a"), workspacePath("copy/b"), workspacePath("copy/c")],
          },
        ],
      }),
    });
    const buttons = screen.getAllByRole("button", { name: "別の作品として取り込む" });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]!);
    expect(await screen.findByText(/「copy\/b」の作品IDを新しくして/)).toBeInTheDocument();
  });

  it("登録済みのパスが診断にないID重複は、作品名で作品詳細を開く", async () => {
    const user = userEvent.setup();
    const props = renderTab({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            registeredTitle: "登録済みの作品",
            registeredPath: null,
            workId: "w",
            paths: [workspacePath("x"), workspacePath("y")],
          },
        ],
      }),
    });
    await user.click(screen.getByRole("button", { name: "登録済みの作品" }));
    expect(props.onOpenWorkDetail).toHaveBeenCalledWith("w");
  });

  it("登録済みの作品名が読めないID重複は、登録済みのパスを出す", () => {
    renderTab({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            registeredTitle: null,
            registeredPath: workspacePath("x"),
            workId: "w",
            paths: [workspacePath("x"), workspacePath("y")],
          },
        ],
      }),
    });
    const registered = rowOf("ID重複").getByText("登録済み").parentElement!;
    expect(within(registered).getByRole("button", { name: "x" })).toBeInTheDocument();
  });

  it("登録済みの作品が無いID重複は、未登録として先頭のパスを取り込める", () => {
    renderTab({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            registeredTitle: null,
            registeredPath: null,
            workId: "w",
            paths: [workspacePath("x"), workspacePath("y")],
          },
        ],
      }),
    });
    expect(screen.queryByText("登録済み")).toBeNull();
    expect(screen.getAllByRole("button", { name: "別の作品として取り込む" })).toHaveLength(1);
  });

  it("単一ファイル形式の重複は、トーストに作品情報ファイルの接尾辞を出さない", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/works/identity-conflicts/reassign": buildWorkSourceMutationResult(),
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab({
      diagnostics: buildScanDiagnostics({
        identityConflicts: [
          {
            kind: "identity_conflict",
            registeredTitle: "単一",
            registeredPath: workspacePath("a/single.mimimilli.json"),
            workId: "w",
            paths: [
              workspacePath("a/single.mimimilli.json"),
              workspacePath("b/single.mimimilli.json"),
            ],
          },
        ],
      }),
    });
    await user.click(screen.getByRole("button", { name: "別の作品として取り込む" }));
    await user.click(await screen.findByRole("button", { name: "取り込む" }));
    expect(await screen.findByText("「single」を別の作品として取り込みました")).toBeInTheDocument();
  });

  it("別の作品として取り込むは確認を経て reassign を呼び、対象名入りのトーストを出す", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "POST /api/works/identity-conflicts/reassign": buildWorkSourceMutationResult(),
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "別の作品として取り込む" }));
    expect(api.requestsTo("POST /api/works/identity-conflicts/reassign")).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: "取り込む" }));
    await waitFor(() =>
      expect(api.requestsTo("POST /api/works/identity-conflicts/reassign")).toHaveLength(1),
    );
    expect(await screen.findByText("「b」を別の作品として取り込みました")).toBeInTheDocument();
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
    expect(screen.getByText("壊れた作品")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "壊れた作品" })).toBeNull();
  });

  it("データ不整合は作品名を出し、タイトルが読めないときは作品IDだけを出す", () => {
    renderTab({
      diagnostics: buildScanDiagnostics({
        dataIntegrityWorks: [{ workId: "work-untitled", title: null }],
      }),
    });
    const row = rowOf("データ不整合");
    expect(row.getByText("work-untitled")).toBeInTheDocument();
    expect(row.queryByRole("button", { name: "work-untitled" })).toBeNull();
    expect(row.getByRole("button", { name: "読み直す" })).toBeInTheDocument();
  });

  it("読み取り失敗とアクセス不可の行には操作ボタンを置かない", () => {
    renderTab();
    expect(
      rowOf("読み取り失敗").queryAllByRole("button", { name: /読み直す|解除|取り込む/ }),
    ).toHaveLength(0);
    expect(
      rowOf("アクセス不可").queryAllByRole("button", { name: /読み直す|解除|取り込む/ }),
    ).toHaveLength(0);
  });

  it("読み直すで POST /works/:id/reload を呼び、対象名入りのトーストを出す", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "POST /api/works/work-int/reload": apiNoContent(),
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "読み直す" }));
    await waitFor(() => expect(api.requestsTo("POST /api/works/work-int/reload")).toHaveLength(1));
    expect(await screen.findByText("「壊れた作品」を読み直しました")).toBeInTheDocument();
  });

  it("読み直しても直らない(409)ときはそう知らせ、行は残る", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/works/work-int/reload": apiError(
        409,
        "reload_unresolved",
        "作品情報ファイルを読み直しても、この作品の保存値を直せませんでした。",
      ),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "読み直す" }));
    expect(await screen.findByText("「壊れた作品」はまだ読み取れません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み直す" })).toBeEnabled();
  });

  it("読み直しが別の理由の409や500で失敗したらサーバーのメッセージを出し、行は残る", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /api/works/work-int/reload": apiError(
        409,
        "conflict",
        "作品情報ファイルが見つかりません。",
      ),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "読み直す" }));
    expect(await screen.findByText("作品情報ファイルが見つかりません。")).toBeInTheDocument();
    expect(screen.queryByText(/まだ読み取れません/)).toBeNull();
    expect(screen.getByRole("button", { name: "読み直す" })).toBeEnabled();
    cleanup();
    mockApi({ "POST /api/works/work-int/reload": apiError(500, "internal", "サーバーエラー") });
    renderTab();
    await user.click(screen.getByRole("button", { name: "読み直す" }));
    expect(await screen.findByText("サーバーエラー")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み直す" })).toBeEnabled();
  });

  it("登録解除は確認を経て DELETE /works/:id を呼び、対象名入りのトーストを出す", async () => {
    const user = userEvent.setup();
    const api = mockApi({
      "DELETE /api/works/work-miss": apiNoContent(),
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/scan/last": buildScanRecord(),
    });
    renderTab();
    await user.click(screen.getByRole("button", { name: "登録解除" }));
    expect(api.requestsTo("DELETE /api/works/work-miss")).toHaveLength(0);
    await user.click(await screen.findByRole("button", { name: "解除する" }));
    await waitFor(() => expect(api.requestsTo("DELETE /api/works/work-miss")).toHaveLength(1));
    expect(await screen.findByText("「消えた作品」を登録解除しました")).toBeInTheDocument();
  });

  it("rootの外にあった行方不明の作品は、タイトルだけを出しパスは出さない", () => {
    renderTab({
      diagnostics: buildScanDiagnostics({
        missingWorks: [{ workId: "work-out", title: "外にあった作品", previousPath: null }],
      }),
    });
    expect(screen.getByRole("button", { name: "外にあった作品" })).toBeInTheDocument();
    expect(screen.queryByText("null")).toBeNull();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("行が無ければ空状態、読み込み中・失敗は状態表示にする", async () => {
    const user = userEvent.setup();
    renderTab({ diagnostics: buildScanDiagnostics() });
    expect(screen.getByText("要対応の項目はありません")).toBeInTheDocument();
    cleanup();
    const api = mockApi({ "GET /api/scan/diagnostics": apiError(500, "internal_error") });
    renderTab({ diagnostics: null });
    await user.click(await screen.findByRole("button", { name: "再試行" }));
    await waitFor(() => expect(api.requestsTo("GET /api/scan/diagnostics")).toHaveLength(2));
  });
});
