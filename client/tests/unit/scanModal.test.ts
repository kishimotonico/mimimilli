// ScanModal のEsc/backdrop挙動のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement, Fragment } from "react";
import { cleanup, render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  type ScanCandidate,
  type ScanJobSnapshot,
  type ScanRecord,
  type Work,
  type WorkEditSnapshot,
  type WorkListItem,
  type WorksPage,
  workspacePath,
} from "@mimimilli/shared";
import * as workApi from "../../src/entities/work/api";
import ScanModal from "../../src/features/scan/ui/ScanModal";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import {
  flushUnregisteredListSize,
  mockUnregisteredListSize,
} from "../helpers/unregisteredListSize";
import { createFakeScanJobStore } from "../helpers/fakeJobStores";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { apiError, apiNoContent, mockApi, type ApiMock, type ApiRequest } from "../helpers/api";
import {
  buildDlsiteNotificationSummary,
  buildScanCandidate,
  buildScanCandidatesRegisterResponse,
  buildScanDiagnostics,
  buildScanRecord,
  buildSettings,
  buildWork,
  buildWorkEditSnapshotOf,
  buildWorkListItem,
  buildWorkSourceMutationResult,
  buildWorksPage,
} from "../helpers/builders";

/** GET /works?scanRecord=new が返す、サーバーの記録上の新規作品。テストごとに登録した作品だけ返す */
const worksById = new Map<string, WorkListItem>();
let api: ApiMock;
let worksByIdFails = false;
let patchWorkSourceReply: (request: ApiRequest) => unknown;
let registerReply: unknown;
let serverCandidates: ScanCandidate[] = [];
const updatedFixture: ScanRecord["updatedWorks"] = [
  {
    workId: "u1",
    changes: [
      { kind: "moved", from: workspacePath("旧/u1"), to: workspacePath("u1") },
      { kind: "files", audioDelta: 3 },
    ],
  },
  { workId: "u2", changes: [{ kind: "meta" }, { kind: "files", audioDelta: 0 }] },
];

function toListItem(id: string, title: string, trackCount: number): WorkListItem {
  return buildWorkListItem({ id, title, trackCount });
}

function scanRecordQueries() {
  return api
    .requestsTo("GET /api/works")
    .filter((request) => request.url.searchParams.get("scanRecord") === "new");
}

/** 契約形式（{error:{code,message}}）ではない500。利用者向け文言を持たない失敗として扱われる */
function unstructuredServerError(): Response {
  return new Response("Internal Server Error", { status: 500 });
}

function saveTitleReply(request: ApiRequest) {
  const { title } = request.body as { title: string };
  const item = worksById.get(newWork.id);
  if (item) worksById.set(newWork.id, { ...item, title });
  return buildWorkSourceMutationResult(scanSnapshot(title));
}

let restoreListSize: () => void = () => {};
afterEach(() => restoreListSize());

async function waitForListed(text: string) {
  await waitFor(() => {
    flushUnregisteredListSize();
    expect(screen.getByText(text)).toBeInTheDocument();
  });
}

async function showUnregisteredList() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushUnregisteredListSize();
  });
}

beforeEach(() => {
  restoreListSize = mockUnregisteredListSize();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });

  worksById.clear();
  worksById.set(newWork.id, toListItem(newWork.id, newWork.title, newWork.trackCount));
  worksByIdFails = false;
  patchWorkSourceReply = saveTitleReply;
  registerReply = buildScanCandidatesRegisterResponse();
  serverCandidates = [];
  api = mockApi({
    "GET /api/works": ({ url }) => {
      if (url.searchParams.get("scanRecord") === "updated") {
        const kind = url.searchParams.get("scanChange");
        const items = updatedFixture
          .filter((entry) => !kind || entry.changes.some((change) => change.kind === kind))
          .map((entry) => toListItem(entry.workId, `更新${entry.workId}`, 1));
        return buildWorksPage(items, { total: items.length });
      }
      if (url.searchParams.get("scanRecord") !== "new") {
        return buildWorksPage([], { total: 0 });
      }
      if (worksByIdFails) return unstructuredServerError();
      const page = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 200);
      const all = [...worksById.values()];
      return buildWorksPage(all.slice((page - 1) * limit, page * limit), { total: all.length });
    },
    "GET /api/works/:id": ({ params }) =>
      params.id === work.id ? work : apiError(404, "not_found", `work not found: ${params.id}`),
    "GET /api/works/:id/source": () => scanSnapshot(work.title),
    "PATCH /api/works/:id": (request) => patchWorkSourceReply(request),
    "POST /api/scan/candidates/register": () => registerReply,
    "POST /api/scan/candidates/rj-code": ({ body }) => {
      const { path, rjCode } = body as { path: string; rjCode: string };
      const base = serverCandidates.find((candidate) => candidate.path === path);
      return { candidate: { ...base, rjCode: rjCode === "" ? null : rjCode } };
    },
    "POST /api/scan/candidates/exclude": () => apiNoContent(),
    "POST /api/scan/candidates/exclusions/restore": () => apiNoContent(),
    "GET /api/scan/candidates": () => ({ candidates: serverCandidates }),
    "GET /api/scan/candidates/exclusions": { paths: [] },
    "GET /api/scan/last": () => apiNoContent(),
    "GET /api/scan/diagnostics": buildScanDiagnostics(),
    "GET /api/dlsite/notifications": buildDlsiteNotificationSummary(),
    "GET /api/settings": buildSettings(),
  });
});

const newWork = { id: "work-1", title: "追加された作品", trackCount: 1 };

const work: Work = buildWork({
  id: newWork.id,
  title: newWork.title,
  physicalPath: "/audio/work-1",
  totalDurationSec: 120,
});

function scanSnapshot(title: string): WorkEditSnapshot {
  return buildWorkEditSnapshotOf({ ...work, title });
}

const scanRecord: ScanRecord = buildScanRecord();

const candidateDetected: ScanCandidate = buildScanCandidate({
  path: "dlsite/検出済み作品",
  inferredTitle: "検出済み作品",
  audioFileCount: 2,
  audioBreakdown: [{ extension: "mp3", count: 2 }],
  rjCode: "RJ100001",
});
const candidateUndetected: ScanCandidate = buildScanCandidate({
  path: "dlsite/未検出作品",
  inferredTitle: "未検出作品",
});

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

function createRunningJob(
  progress: ScanJobSnapshot["progress"] = { phase: "registering", processed: 3, total: 12 },
): ScanJobSnapshot {
  return {
    id: "job-1",
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: null,
    progress,
    error: null,
  };
}

type ModalOverrides = Partial<Parameters<typeof ScanModal>[0]> & {
  /** ScanModal 自身が SCAN_QUERY_KEYS.last() を購読するため、query cache 経由で渡す */
  record?: ScanRecord;
  /** 候補は GET /scan/candidates 由来の query cache から読まれる */
  candidates?: ScanCandidate[];
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
}

function seedScanQueries(
  queryClient: QueryClient,
  { record, candidates }: { record?: ScanRecord; candidates?: ScanCandidate[] },
) {
  if (record !== undefined) {
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), record);
  }
  if (candidates !== undefined) {
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), candidates);
  } else if (queryClient.getQueryData(SCAN_QUERY_KEYS.candidates()) === undefined) {
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
  }
  // ID重複の診断（常に最新を購読する）。未シードだとテストごとに実fetchへ
  // 落ちてしまうため、明示的な指定がなければ空で固定する。
  if (queryClient.getQueryData(SCAN_QUERY_KEYS.diagnostics()) === undefined) {
    queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
  }
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${name}`) }));
}

function renderModal(
  overrides: ModalOverrides = {},
  scanState: { job?: ScanJobSnapshot | null } = {},
) {
  const store = createStore();
  const scanJob = createFakeScanJobStore({ job: scanState.job ?? null });
  const onStart = scanJob.start;
  const onCancel = scanJob.cancel;
  store.set(scanJobStoreAtom, scanJob);

  const { record, candidates, ...rest } = overrides;
  serverCandidates = candidates ?? [];
  const queryClient = createTestQueryClient();
  seedScanQueries(queryClient, {
    record: record !== undefined ? record : scanRecord,
    candidates,
  });

  const modalProps = {
    lastScanTime: null,
    onClose: vi.fn(),
    ...rest,
  };

  // Toastは単一ホスト（GlobalToast）へ集約されているため、ScanModal・
  // UnregisteredTabの表示要求を目に見える形で検証するにはGlobalToastも一緒に描画する。
  const globalToast = () =>
    createElement(GlobalToast, {
      onOpenScan: () => {},
      onOpenScanNeedsAttention: () => {},
      onRetrySkippedTrack: () => {},
    });

  const view = render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(Fragment, null, createElement(ScanModal, modalProps), globalToast()),
      ),
    ),
  );

  const rerenderModal = (newOverrides: ModalOverrides = {}) => {
    const { record: newRecord, candidates: newCandidates, ...newRest } = newOverrides;
    seedScanQueries(queryClient, { record: newRecord, candidates: newCandidates });
    view.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(
            Fragment,
            null,
            createElement(ScanModal, { ...modalProps, ...newRest }),
            globalToast(),
          ),
        ),
      ),
    );
  };

  return { ...view, store, scanJob, onStart, onCancel, rerenderModal, queryClient };
}

describe("ScanModal", () => {
  it("Escapeはモーダルを閉じる（タイトル編集中でも、タブが編集stateを自分で持つため親は関知しない）", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    openTab("新規作品");
    await waitForListed(newWork.title);
    fireEvent.click(screen.getByText(newWork.title));
    expect(screen.getByDisplayValue(newWork.title)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "スキャン" });
    dispatchCancel(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("×ボタンはモーダルを閉じる（タイトル編集中でも）", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    openTab("新規作品");
    await waitForListed(newWork.title);
    fireEvent.click(screen.getByText(newWork.title));
    expect(screen.getByDisplayValue(newWork.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdropクリックはモーダルを閉じる", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const dialog = screen.getByRole("dialog", { name: "スキャン" });
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("パネル内側のクリックではモーダルを閉じない", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole("heading", { name: "スキャン" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("実行中はフェーズと進捗を表示し、中止ボタンを表示する", () => {
    const onClose = vi.fn();
    const { onCancel } = renderModal(
      { onClose },
      {
        job: createRunningJob({ phase: "registering", processed: 3, total: 12 }),
      },
    );

    expect(screen.getByRole("dialog", { name: "スキャン" })).toBeInTheDocument();
    expect(screen.getByText("作品を登録中")).toBeInTheDocument();
    expect(screen.getByText("3/12")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "スキャン" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "スキャンを中止" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("サイドバーの「スキャン」で差分スキャンを始め、集計行と「再スキャン」は無い", () => {
    const { onStart } = renderModal({ record: scanRecord });

    expect(screen.queryByText("ライブラリ全体")).toBeNull();
    expect(screen.queryByText("更新なし")).toBeNull();
    expect(screen.queryByRole("button", { name: "再スキャン" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "スキャン" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith();
  });

  it("▾のメニューの「すべての作品を読み直す」で全件スキャンを始める", () => {
    const { onStart } = renderModal({ record: scanRecord });

    fireEvent.click(screen.getByRole("button", { name: "スキャンの方法" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "すべての作品を読み直す" }));
    expect(onStart).toHaveBeenCalledExactlyOnceWith({ full: true });
  });

  it("縦タブは未登録・新規作品・要対応・更新済みの順で、件数は未登録と要対応だけに出る", () => {
    renderModal({
      candidates: [candidateDetected, candidateUndetected],
      record: buildScanRecord({
        updatedWorks: [{ workId: "w1", changes: [{ kind: "meta" }] }],
      }),
    });
    openTab("新規作品");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "未登録（2件）",
      "新規作品",
      "要対応",
      "更新済み",
    ]);
  });

  it("要対応の件数は直すものだけを数え、行方不明は数えない", () => {
    const missing = { workId: "m1", title: "m1", previousPath: workspacePath("m1") };
    renderModal({ record: buildScanRecord({ missingWorks: [missing] }) });
    expect(screen.getByRole("tab", { name: "要対応" })).toBeInTheDocument();
    cleanup();

    renderModal({
      record: buildScanRecord({
        missingWorks: [missing],
        unreadablePaths: [workspacePath("locked")],
        dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["w1"] },
      }),
    });
    expect(screen.getByRole("tab", { name: "要対応（2件）" })).toBeInTheDocument();
  });

  it("開いていないタブにだけ件数を出す", () => {
    renderModal({ candidates: [candidateDetected, candidateUndetected] });
    openTab("新規作品");

    expect(screen.getByRole("tab", { name: "未登録（2件）" })).toBeInTheDocument();
    openTab("未登録");
    expect(screen.getByRole("tab", { name: "未登録" })).toBeInTheDocument();
  });

  it("最終スキャンの日時を年入りで出す", () => {
    renderModal({ lastScanTime: new Date(2026, 10, 8, 17, 49).toISOString() });

    expect(screen.getByText("最終スキャン")).toBeInTheDocument();
    expect(screen.getByText("2026/11/08 17:49")).toBeInTheDocument();
  });

  it("実行中から完了への遷移を見ていたときだけ、完了サインが一時的に出る", async () => {
    vi.useFakeTimers();
    try {
      const { scanJob, rerenderModal } = renderModal(
        { record: scanRecord },
        { job: createRunningJob({ phase: "registering", processed: 1, total: 1 }) },
      );

      act(() => {
        scanJob.setState({ job: null, error: null });
        rerenderModal({ lastScanTime: "2026-01-01T00:00:00.000Z" });
      });

      expect(screen.getByText("完了しました")).toBeInTheDocument();

      // レイアウトは動かさず、時間経過（ScanModal の COMPLETION_HINT_MS=2400 と
      // AnimatePresence（fade variant）の退出時間=150ms）で最終スキャン表示へ自然に戻る。
      // 2回に分けて進めるのは、退出アニメーション開始（状態遷移でAnimatePresenceが退出
      // フェーズへ入るタイミング）が一括advanceだと後続タイマーとして拾われないため。
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2450);
      });
      // COMPLETION_HINT_MS(2400)は過ぎてstateはlastScanへ切り替わり退出フェーズに入っているが、
      // fadeの退出アニメーション(150ms)がまだ終わっていないため、AnimatePresenceがマウントを
      // 保ったままで「完了しました」がまだDOM上に残っている（退出中に即座に消える実装への退行を検知する）。
      expect(screen.getByText("完了しました")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(screen.queryByText("完了しました")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("新規作品は記録の絞り込み（scanRecord=new）で取得し、getWorkを呼ばない", async () => {
    const workA = { id: "work-a", title: "作品A", trackCount: 2 };
    worksById.set(workA.id, toListItem(workA.id, workA.title, workA.trackCount));

    renderModal();
    openTab("新規作品");
    await waitForListed(workA.title);
    expect(screen.getByText(newWork.title)).toBeInTheDocument();

    expect(api.requestsTo("GET /api/works/:id")).toHaveLength(0);
    expect(scanRecordQueries().length).toBeGreaterThan(0);
  });

  it("新規作品が1ページを超えても見える行だけ描画し、末尾に近づくと次のページを取得する", async () => {
    const manyIds = Array.from({ length: 999 }, (_, i) => `work-many-${i}`);
    for (const id of manyIds) worksById.set(id, toListItem(id, `題名${id}`, 1));

    renderModal();
    openTab("新規作品");
    await waitForListed("題名work-many-0");

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeLessThan(40);
    expect(scanRecordQueries().map((request) => request.url.searchParams.get("page"))).toEqual([
      "1",
    ]);

    const scroller = screen
      .getByRole("table", { name: "新規作品" })
      .querySelector<HTMLElement>(".overflow-y-auto");
    if (!scroller) throw new Error("scroller not found");
    scroller.scrollTop = 52 * 495;
    fireEvent.scroll(scroller);

    await waitFor(() =>
      expect(scanRecordQueries().map((request) => request.url.searchParams.get("page"))).toEqual([
        "1",
        "2",
      ]),
    );
  });

  it("新規作品一覧の取得に失敗したときエラーを表示する", async () => {
    worksByIdFails = true;

    renderModal();
    openTab("新規作品");

    await waitFor(() =>
      expect(screen.getByText("新規作品の読み込みに失敗しました")).toBeInTheDocument(),
    );
    expect(screen.queryByText(newWork.title)).toBeNull();
  });

  it("タイトル保存に失敗したときエラーを表示し、ローカル表示は更新されない", async () => {
    patchWorkSourceReply = unstructuredServerError;
    renderModal();
    openTab("新規作品");

    await waitForListed(newWork.title);
    fireEvent.click(screen.getByText(newWork.title));
    const input = screen.getByDisplayValue(newWork.title);
    fireEvent.change(input, { target: { value: "新しいタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(screen.getByText("タイトルの保存に失敗しました")).toBeInTheDocument(),
    );
    // 失敗時はローカルの表示名を更新せず、入力欄は編集状態のまま残る（再試行可能）
    expect(screen.getByDisplayValue("新しいタイトル")).toBeInTheDocument();
    expect(screen.queryByText(newWork.title)).toBeNull();
  });

  it("タイトル保存に成功したとき表示名が更新され編集モードが閉じる", async () => {
    renderModal();
    openTab("新規作品");

    await waitForListed(newWork.title);
    fireEvent.click(screen.getByText(newWork.title));
    const input = screen.getByDisplayValue(newWork.title);
    fireEvent.change(input, { target: { value: "新しいタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("新しいタイトル")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("新しいタイトル")).toBeNull();
  });

  it("タイトル保存に成功すると正本キャッシュを更新し、一覧クエリを再取得する", async () => {
    const { queryClient } = renderModal();
    openTab("新規作品");

    await waitForListed(newWork.title);
    const searchCallsBefore = scanRecordQueries().length;
    fireEvent.click(screen.getByText(newWork.title));
    const input = screen.getByDisplayValue(newWork.title);
    fireEvent.change(input, { target: { value: "新しいタイトル" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("新しいタイトル")).toBeInTheDocument());

    expect(queryClient.getQueryData(WORK_QUERY_KEYS.source(newWork.id))).toMatchObject({
      title: "新しいタイトル",
    });
    expect(scanRecordQueries().length).toBeGreaterThan(searchCallsBefore);
    const cachedList = queryClient.getQueryData<InfiniteData<WorksPage>>([
      ...WORK_QUERY_KEYS.list({ scanRecord: "new" }),
      "scanRecord",
    ]);
    expect(cachedList?.pages[0]?.items[0]?.title).toBe("新しいタイトル");
  });

  it("空文字・空白のみのタイトルは保存されず編集モードだけ閉じる", async () => {
    renderModal();
    openTab("新規作品");

    await waitForListed(newWork.title);
    fireEvent.click(screen.getByText(newWork.title));
    const input = screen.getByDisplayValue(newWork.title);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(api.requestsTo("PATCH /api/works/:id")).toHaveLength(0);
    expect(screen.getByText(newWork.title)).toBeInTheDocument();
  });

  it("登録リクエストは候補のパスだけを送り（RJコードはサーバーが持つ）、全件登録で新規作品へ自動遷移する", async () => {
    registerReply = buildScanCandidatesRegisterResponse({
      registered: [
        { path: candidateDetected.path, workId: "w-detected" },
        { path: candidateUndetected.path, workId: "w-undetected" },
      ],
    });
    renderModal({
      candidates: [candidateDetected, candidateUndetected],
    });

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    await expect.poll(() => unregistered.textContent).toContain(candidateDetected.inferredTitle);

    fireEvent.click(within(unregistered).getByRole("button", { name: "2件を追加" }));

    await waitFor(() =>
      expect(api.requestsTo("POST /api/scan/candidates/register")).toHaveLength(1),
    );
    expect(api.requestsTo("POST /api/scan/candidates/register")[0]?.body).toEqual({
      paths: [candidateDetected.path, candidateUndetected.path],
      apply: { title: true, cover: true, tags: true, url: true },
    });

    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: /^新規作品/ })).toBeInTheDocument(),
    );
  });

  it("全件追加に成功したときは警告トーストを出さない", async () => {
    registerReply = buildScanCandidatesRegisterResponse({
      registered: [{ path: candidateDetected.path, workId: "w-detected" }],
    });
    renderModal({ candidates: [candidateDetected] });
    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    fireEvent.click(within(unregistered).getByRole("button", { name: "1件を追加" }));
    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: /^新規作品/ })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/追加できませんでした|止まりました/)).toBeNull();
  });

  it("途中で止まったときは追加できた件数つきの警告トーストを出して新規作品へ移る", async () => {
    const registerSpy = vi.spyOn(workApi, "registerScanCandidates").mockResolvedValue({
      registered: [{ path: candidateDetected.path, workId: "w-detected" }],
      failures: [],
      interruptedBy: new Error("通信エラー"),
    });
    onTestFinished(() => registerSpy.mockRestore());
    renderModal({ candidates: [candidateDetected, candidateUndetected] });
    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    fireEvent.click(within(unregistered).getByRole("button", { name: "2件を追加" }));
    await waitFor(() =>
      expect(
        screen.getByText("1件を追加して止まりました。残りは未登録タブから追加してください。"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("tabpanel", { name: /^新規作品/ })).toBeInTheDocument();
  });

  it("候補登録に成功すると作品一覧・軸件数・DLsite通知・スマートフォルダーのクエリを無効化する", async () => {
    registerReply = buildScanCandidatesRegisterResponse({
      registered: [{ path: candidateDetected.path, workId: "w-detected" }],
    });
    const { queryClient } = renderModal({
      candidates: [candidateDetected],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    await expect.poll(() => unregistered.textContent).toContain(candidateDetected.inferredTitle);
    fireEvent.click(within(unregistered).getByRole("button", { name: "1件を追加" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["works"] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["axisFacets"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dlsiteNotifications"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["smartFolderWorks"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SCAN_QUERY_KEYS.last() });
  });

  it("候補登録が部分失敗しても、成功分がある限り作品一覧等を無効化する", async () => {
    registerReply = buildScanCandidatesRegisterResponse({
      registered: [{ path: candidateDetected.path, workId: "w-detected" }],
      failures: [{ path: candidateUndetected.path, message: "失敗" }],
    });
    const { queryClient } = renderModal({
      candidates: [candidateDetected, candidateUndetected],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    await expect.poll(() => unregistered.textContent).toContain(candidateDetected.inferredTitle);
    fireEvent.click(within(unregistered).getByRole("button", { name: "2件を追加" }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["works"] }));
    await waitFor(() =>
      expect(
        screen.getByText("1件を追加しました。1件は追加できませんでした。"),
      ).toBeInTheDocument(),
    );
  });

  it("候補の除外では作品一覧・軸件数・スマートフォルダーの再取得を行わない（AC#4）", async () => {
    const { queryClient } = renderModal({
      candidates: [candidateUndetected],
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    await expect.poll(() => unregistered.textContent).toContain(candidateUndetected.inferredTitle);
    fireEvent.click(within(unregistered).getByRole("button", { name: "除外" }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: SCAN_QUERY_KEYS.candidateExclusions(),
      }),
    );
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["works"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["axisFacets"] });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["smartFolderWorks"] });
  });

  it("未検出のRJコードをクリックで編集するとサーバーで直り、行の表示が更新され、登録はパスだけを送る", async () => {
    registerReply = buildScanCandidatesRegisterResponse({
      registered: [{ path: candidateUndetected.path, workId: "w-undetected" }],
    });
    renderModal({
      candidates: [candidateDetected, candidateUndetected],
    });

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    fireEvent.click(within(unregistered).getByRole("button", { name: "—" }));
    const input = within(unregistered).getByPlaceholderText("RJコード");
    fireEvent.change(input, { target: { value: "RJ200002" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(api.requestsTo("POST /api/scan/candidates/rj-code")[0]?.body).toEqual({
        path: candidateUndetected.path,
        rjCode: "RJ200002",
      }),
    );
    await waitFor(() => expect(within(unregistered).getByText("RJ200002")).toBeInTheDocument());
    expect(within(unregistered).queryByPlaceholderText("RJコード")).toBeNull();

    fireEvent.click(
      within(unregistered).getByRole("checkbox", {
        name: `「${candidateDetected.inferredTitle}」を選択`,
      }),
    );
    fireEvent.click(within(unregistered).getByRole("button", { name: "1件を追加" }));

    await waitFor(() =>
      expect(api.requestsTo("POST /api/scan/candidates/register")).toHaveLength(1),
    );
    expect(api.requestsTo("POST /api/scan/candidates/register")[0]?.body).toEqual({
      paths: [candidateUndetected.path],
      apply: { title: true, cover: true, tags: true, url: true },
    });
  });

  it("選んだ候補を除外でき、「元に戻す」で取り消せる", async () => {
    renderModal({
      candidates: [candidateDetected, candidateUndetected],
    });

    await showUnregisteredList();
    const unregistered = screen.getByRole("tabpanel", { name: /^未登録/ });
    await expect.poll(() => unregistered.textContent).toContain(candidateUndetected.inferredTitle);

    fireEvent.click(
      within(unregistered).getByRole("checkbox", {
        name: `「${candidateDetected.inferredTitle}」を選択`,
      }),
    );
    fireEvent.click(within(unregistered).getByRole("button", { name: "除外" }));

    await waitFor(() =>
      expect(api.requestsTo("POST /api/scan/candidates/exclude")[0]?.body).toEqual({
        paths: [candidateUndetected.path],
      }),
    );
    await waitFor(() => expect(screen.getByText("1件を候補から外しました")).toBeInTheDocument());
    expect(screen.queryByText(candidateUndetected.inferredTitle)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));

    await waitFor(() =>
      expect(api.requestsTo("POST /api/scan/candidates/exclusions/restore")[0]?.body).toEqual({
        paths: [candidateUndetected.path],
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(candidateUndetected.inferredTitle)).toBeInTheDocument(),
    );
  });

  it("新規作品のパスでFilesを、詳細アイコンで作品詳細を開く", async () => {
    const onOpenFiles = vi.fn();
    const onOpenWorkDetail = vi.fn();
    renderModal({ onOpenFiles, onOpenWorkDetail });
    openTab("新規作品");
    await waitForListed(newWork.title);

    fireEvent.click(screen.getByRole("button", { name: /作品詳細を開く/ }));
    expect(onOpenWorkDetail).toHaveBeenCalledExactlyOnceWith(newWork.id);
    const pathButton = screen.getByTitle(/^Filesで開く: /);
    fireEvent.click(pathButton);
    expect(onOpenFiles).toHaveBeenCalledOnce();
  });

  describe("更新済みタブ", () => {
    const updatedRecord = () => buildScanRecord({ updatedWorks: updatedFixture });

    it("作品ごとに変化を1行ずつ出し、値の差分は出さない", async () => {
      renderModal({ record: updatedRecord() });
      openTab("更新済み");
      await waitForListed("更新u1");

      expect(screen.getByText("旧/u1 → u1")).toBeInTheDocument();
      expect(screen.getByText("音声ファイル +3")).toBeInTheDocument();
      expect(screen.getByText("作品情報ファイルを更新")).toBeInTheDocument();
      expect(screen.getByText("ファイル構成を更新")).toBeInTheDocument();
    });

    it("種類で絞り込むとscanChangeで取り直し、件数0の種類は無効になる", async () => {
      renderModal({ record: updatedRecord() });
      openTab("更新済み");
      await waitForListed("更新u1");

      expect(screen.getByRole("button", { name: /^移動\s*1$/ })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: /^移動/ }));
      await waitFor(() => {
        flushUnregisteredListSize();
        expect(screen.queryByText("更新u2")).toBeNull();
        expect(screen.getByText("更新u1")).toBeInTheDocument();
      });
      expect(
        api
          .requestsTo("GET /api/works")
          .some((request) => request.url.searchParams.get("scanChange") === "moved"),
      ).toBe(true);
    });

    it("作品タイトルを押すと作品詳細を開く", async () => {
      const onOpenWorkDetail = vi.fn();
      renderModal({ record: updatedRecord(), onOpenWorkDetail });
      openTab("更新済み");
      await waitForListed("更新u1");

      fireEvent.click(screen.getByRole("button", { name: "更新u1" }));
      expect(onOpenWorkDetail).toHaveBeenCalledExactlyOnceWith("u1");
    });
  });
});
