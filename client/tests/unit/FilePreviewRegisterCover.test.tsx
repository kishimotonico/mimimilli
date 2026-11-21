// Files からの作品登録で、選んだカバーを適用できなかったときの通知。
import { createElement, type ReactNode } from "react";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workCreateResponseSchema, workRegisterPreviewSchema } from "@mimimilli/shared";
import FilePreview from "../../src/features/files/ui/FilePreview";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { toSelectedRelPath } from "../../src/entities/file-system/model/navigationAtoms";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { seedFilesRoute } from "../helpers/route";
import { mockApi } from "../helpers/api";
import {
  buildFsEntry,
  buildFsListing,
  buildScanDiagnostics,
  buildSettings,
  buildWorkEditSnapshot,
} from "../helpers/builders";

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({ playFile: vi.fn(), togglePlay: vi.fn() }),
}));

const preview = workRegisterPreviewSchema.parse({
  suggestedTitle: "テスト作品",
  tags: [],
  detectedRjCode: null,
  descendantWorkCount: 0,
  alreadyRegistered: false,
  orphanedMeta: false,
});

function renderPreview(coverSkipped: "not_cached" | null) {
  const settings = buildSettings({ rootFolder: "/lib" });
  mockApi({
    "GET /api/fs": buildFsListing([buildFsEntry({ path: "a.mp3" })]),
    "GET /api/scan/diagnostics": buildScanDiagnostics(),
    "GET /api/scan/candidates": { scanCompleted: true, candidates: [] },
    "GET /api/settings": settings,
    "GET /api/tags": [],
    "GET /api/tag-prefixes": [],
    "GET /api/works/register-preview": preview,
    "POST /api/works": workCreateResponseSchema.parse({
      snapshot: buildWorkEditSnapshot(),
      projection: { status: "published" },
      coverSkipped,
    }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), settings);
  const store = createStore();
  seedFilesRoute(store, { selectedRelPath: toSelectedRelPath("a.mp3") });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  render(
    createElement(
      wrapper,
      null,
      createElement(FilePreview),
      createElement(GlobalToast, {
        onOpenScan: () => {},
        onOpenScanNeedsAttention: () => {},
        onRetrySkippedTrack: () => {},
      }),
    ),
  );
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

async function register() {
  await userEvent.click(
    await screen.findByRole("button", { name: "このファイルを作品として登録" }),
  );
  await userEvent.click(await screen.findByRole("button", { name: "登録" }));
}

describe("Filesの作品登録の通知", () => {
  it("カバーを適用できなかったときは、登録できたことと合わせて警告トーストで伝える", async () => {
    renderPreview("not_cached");
    await register();
    await waitFor(() =>
      expect(
        screen.getByText("作品を登録しました。カバーは適用できませんでした"),
      ).toBeInTheDocument(),
    );
  });

  it("カバーの問題がなければトーストを出さない", async () => {
    renderPreview(null);
    await register();
    await waitFor(() => expect(screen.queryByRole("button", { name: "登録" })).toBeNull());
    expect(screen.queryByText(/カバーは適用できませんでした/)).toBeNull();
  });
});
