// 並べ替えの保存中（PUT /smart-folders/order が未完了）は、サイドバーの行がドラッグ元にならない。
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibrarySidebarPanel from "../../src/features/library/ui/LibrarySidebarPanel";
import { SMART_FOLDER_DRAG_TYPE } from "../../src/features/library/ui/SidebarEditRow";
import { mockApi } from "../helpers/api";
import { defaultSmartFolders } from "../helpers/smartFolders";

type MonitorConfig = {
  onDrop: (args: {
    source: { data: Record<string, unknown> };
    location: { current: { dropTargets: Array<{ data: Record<string, unknown> }> } };
  }) => void;
};

const monitor = vi.hoisted(() => ({ config: null as MonitorConfig | null }));

vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@atlaskit/pragmatic-drag-and-drop/element/adapter")>()),
  monitorForElements: (config: MonitorConfig) => {
    monitor.config = config;
    return () => {
      monitor.config = null;
    };
  },
}));
vi.mock("@atlaskit/pragmatic-drag-and-drop-hitbox/list-item", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@atlaskit/pragmatic-drag-and-drop-hitbox/list-item")>()),
  extractInstruction: () => ({ operation: "reorder-after" }),
}));

afterEach(() => {
  cleanup();
  monitor.config = null;
  vi.unstubAllGlobals();
});

describe("サイドバーの並べ替えの保存中のロック", () => {
  it("保存が終わるまで行は draggable でなく、終わると戻る", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mockApi({
      "PUT /api/smart-folders/order": async () => {
        await gate;
        return defaultSmartFolders();
      },
      "GET /api/smart-folders/counts": {},
    });
    const folders = defaultSmartFolders();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <div className="mle-app">
          <LibrarySidebarPanel
            folders={{ status: "ready", folders }}
            activeFolderId="all"
            activeGroup={null}
            tagPrefixes={[]}
            onOpenFolder={vi.fn()}
            onReplaceFolder={vi.fn()}
            onOpenGroupValue={vi.fn()}
            onAddTag={vi.fn()}
            stats={{ status: "loading" }}
          />
        </div>
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    const rows = () => [...view.container.querySelectorAll<HTMLElement>("[data-folder-id]")];
    await waitFor(() => expect(rows()[0]!.getAttribute("draggable")).toBe("true"));

    act(() =>
      monitor.config!.onDrop({
        source: { data: { type: SMART_FOLDER_DRAG_TYPE, id: folders[0]!.id } },
        location: { current: { dropTargets: [{ data: { id: folders[1]!.id } }] } },
      }),
    );
    await waitFor(() => expect(rows()[0]!.getAttribute("draggable")).not.toBe("true"));

    await act(async () => finish());
    await waitFor(() => expect(rows()[0]!.getAttribute("draggable")).toBe("true"));
  });
});
