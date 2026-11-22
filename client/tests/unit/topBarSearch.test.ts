// 検索入力の IME composition 対応とクリア動作の検証。

import { act, createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { appModeAtom } from "../../src/entities/navigation/model/appRouteStore";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { buildScanDiagnostics, buildScanRecord } from "../helpers/builders";
import { mockApi } from "../helpers/api";
import { seedAppMode, seedLibraryRoute } from "../helpers/route";
import { seedSmartFolders } from "../helpers/smartFolders";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";

const PLACEHOLDER = /ライブラリを検索/;

function renderTopBar(initialQuery = "") {
  const store = createStore();
  seedAppMode(store, "library");
  seedLibraryRoute(store, { q: initialQuery });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  seedSmartFolders(queryClient);
  queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), { scanCompleted: true, candidates: [] });
  queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord());
  queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
  queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), 0);
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(LibraryNavigationProvider, null, createElement(TopBar)),
      ),
    ),
  );
  return store;
}

describe("TopBar の検索入力", () => {
  it("通常入力は即時表示され atom へも即時反映される", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "asmr" } });
    expect(input).toHaveValue("asmr");
    expect(store.get(libraryRouteAtom).q).toBe("asmr");
  });

  it("IME composition 中は atom へ反映せず表示だけ更新し、確定時に反映する", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "あ" } });
    fireEvent.change(input, { target: { value: "あい" } });
    expect(store.get(libraryRouteAtom).q).toBe("");
    expect(input).toHaveValue("あい");

    fireEvent.compositionEnd(input);
    expect(store.get(libraryRouteAtom).q).toBe("あい");
  });

  it("クリアボタンで表示・atom ともに即時空になる", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).toHaveValue("asmr");

    fireEvent.click(screen.getByRole("button", { name: "検索をクリア" }));
    expect(store.get(libraryRouteAtom).q).toBe("");
    expect(input).toHaveValue("");
  });

  it("atom の値が外部要因で変わったとき表示が追従する", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    act(() => {
      seedLibraryRoute(store, { q: "復元された語" });
    });
    expect(input).toHaveValue("復元された語");
  });

  it("⌘K で検索ボックスへフォーカスする", () => {
    renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("他のテキスト入力にフォーカス中の⌘Kは横取りしない", () => {
    renderTopBar("");
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();

    fireEvent.keyDown(other, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(other);

    document.body.removeChild(other);
  });

  it("値がある状態のEscapeはクリアだけ行いフォーカスは検索欄に残る", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(store.get(libraryRouteAtom).q).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("空の状態のEscapeはblurして直前のフォーカス先へ戻す", () => {
    renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    fireEvent.focus(input, { relatedTarget: trigger });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it("IME変換中のEscapeは無視する", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(input).toHaveValue("asmr");
    expect(store.get(libraryRouteAtom).q).toBe("asmr");
  });

  it("作品詳細でも検索欄が使える", () => {
    const store = createStore();
    seedAppMode(store, { workDetail: "RJ501012" });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    seedSmartFolders(queryClient);
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), { scanCompleted: true, candidates: [] });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord());
    queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
    queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), 0);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(LibraryNavigationProvider, null, createElement(TopBar)),
        ),
      ),
    );
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });

  it("作品詳細でEnterを確定するとライブラリへ移り、直前の選択作品はプレビューに残す（意図した挙動）", () => {
    const store = createStore();
    seedAppMode(store, { workDetail: "RJ501012" });
    // 全画面詳細を開く前にライブラリ側で選択していた作品。検索確定はプレビュー文脈を
    // 壊さない設計とし、クリアしない（クリアしてもプレビューが空になるだけで得るものがない）。
    seedLibraryRoute(store, { selectedWorkId: "RJ501011" });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    seedSmartFolders(queryClient);
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), { scanCompleted: true, candidates: [] });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord());
    queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
    queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), 0);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(LibraryNavigationProvider, null, createElement(TopBar)),
        ),
      ),
    );
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "asmr" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.get(appModeAtom)).toBe("library");
    expect(store.get(libraryRouteAtom).selectedWorkId).toBe("RJ501011");
  });
});

describe("効いていない検索語は検索欄に出さない", () => {
  it("値一覧を直接開いたとき、URL の q は検索欄に出ない", () => {
    const store = createStore();
    seedAppMode(store, "library");
    seedLibraryRoute(store, { folderId: "by-cv", group: null, q: "foo" });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    seedSmartFolders(queryClient);
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), { scanCompleted: true, candidates: [] });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord());
    queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
    queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), 0);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(LibraryNavigationProvider, null, createElement(TopBar)),
        ),
      ),
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue("");
  });
});

describe("スマートフォルダー一覧を取れるまで", () => {
  it("一覧が無い間は検索欄を入力できない", () => {
    const store = createStore();
    seedAppMode(store, "library");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), { scanCompleted: true, candidates: [] });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord());
    queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics());
    queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), 0);
    mockApi({ "GET /api/smart-folders": () => new Promise<Response>(() => {}) });
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(LibraryNavigationProvider, null, createElement(TopBar)),
        ),
      ),
    );

    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeDisabled();
  });
});

describe("値一覧・読めない行からの検索は「すべて」の検索結果へ移る（ADR-0041）", () => {
  it("値一覧でも検索欄は有効", () => {
    const store = renderTopBar("");
    act(() => seedLibraryRoute(store, { folderId: "by-cv" }));
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;

    expect(input).not.toBeDisabled();
  });

  it("値一覧で入力すると「すべて」の検索結果へ移り、チップは持ち込まない", () => {
    const store = renderTopBar("");
    act(() => seedLibraryRoute(store, { folderId: "by-cv", selectedTags: ["cv/藤田茜"] }));
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "雨" } });
    const { folderId, group, q, selectedTags } = store.get(libraryRouteAtom);
    expect({ folderId, group, q, selectedTags }).toEqual({
      folderId: "all",
      group: null,
      q: "雨",
      selectedTags: [],
    });
  });

  it("作品一覧ではその一覧のまま検索する", () => {
    const store = renderTopBar("");
    act(() => seedLibraryRoute(store, { folderId: "fav" }));
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "雨" } });
    expect(store.get(libraryRouteAtom).folderId).toBe("fav");
    expect(store.get(libraryRouteAtom).q).toBe("雨");
  });

  it("値一覧でも⌘Kで検索欄へフォーカスする", () => {
    const store = renderTopBar("");
    act(() => seedLibraryRoute(store, { folderId: "by-cv" }));
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    input.blur();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });
});
