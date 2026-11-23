import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SidebarRow } from "../../src/features/library/model/sidebarRows";
import SidebarEditRow, {
  SMART_FOLDER_DRAG_TYPE,
} from "../../src/features/library/ui/SidebarEditRow";
import { useSidebarReorder } from "../../src/features/library/ui/useSidebarReorder";

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
  monitor.config = null;
});

const row = { id: "fav", name: "お気に入り", icon: "star" } as unknown as SidebarRow;

function drop(sourceId: string, targetId: string) {
  monitor.config!.onDrop({
    source: { data: { type: SMART_FOLDER_DRAG_TYPE, id: sourceId } },
    location: { current: { dropTargets: [{ data: { id: targetId } }] } },
  });
}

describe("並べ替えの保存中は次のドラッグを受け付けない", () => {
  it("保存が終わるまで saving が true で、終わると false に戻る", async () => {
    let finish!: () => void;
    const reorder = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useSidebarReorder({
        enabled: true,
        orderedIds: ["a", "b", "c"],
        reorder,
        onDragStart: vi.fn(),
      }),
    );
    expect(result.current.saving).toBe(false);

    act(() => drop("a", "c"));
    expect(reorder).toHaveBeenCalledWith(["b", "c", "a"]);
    expect(result.current.saving).toBe(true);

    await act(async () => finish());
    expect(result.current.saving).toBe(false);
  });

  it("行は dragLocked の間だけドラッグ元にならない", () => {
    const props = {
      row,
      canRemove: true,
      draggableEnabled: true,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    };
    const view = render(<SidebarEditRow {...props} dragLocked={false} />);
    const element = () => view.container.querySelector<HTMLElement>("[data-folder-id]")!;
    expect(element().getAttribute("draggable")).toBe("true");

    view.rerender(<SidebarEditRow {...props} dragLocked />);
    expect(element().getAttribute("draggable")).not.toBe("true");
  });
});
