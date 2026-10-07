import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRevealSelectedWork } from "../../src/features/library/ui/useRevealSelectedWork";

type Props = Parameters<typeof useRevealSelectedWork>[0];

function setup(initial: Partial<Props> = {}) {
  const virtualizer = { scrollToIndex: vi.fn(), scrollToOffset: vi.fn() };
  const base: Props = {
    selectedWorkId: null,
    resetKey: "key-1",
    selectedIndex: -1,
    selectedRowIndex: undefined,
    isLayoutReady: true,
    virtualizer,
    ...initial,
  };
  const hook = renderHook((props: Props) => useRevealSelectedWork(props), {
    initialProps: base,
  });
  return {
    virtualizer,
    update: (next: Partial<Props>) => hook.rerender({ ...base, ...next }),
  };
}

describe("useRevealSelectedWork", () => {
  it("mount時に選択があれば、選択作品の行へ寄せる", () => {
    const { virtualizer } = setup({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: 3 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: "auto" });
  });

  it("mount時に選択が無ければ動かさない", () => {
    const { virtualizer } = setup();
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  it("選択解除ではスクロールしない", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    virtualizer.scrollToIndex.mockClear();
    update({ selectedWorkId: null, selectedIndex: -1, selectedRowIndex: undefined });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  it("選択が別の作品へ変わったら、その行へ寄せる", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    update({ selectedWorkId: "w40", selectedIndex: 40, selectedRowIndex: 20 });
    expect(virtualizer.scrollToIndex).toHaveBeenLastCalledWith(20, { align: "auto" });
  });

  it("選択解除のあと同じ作品を選び直したら、寄せる", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    update({ selectedWorkId: null, selectedIndex: -1, selectedRowIndex: undefined });
    virtualizer.scrollToIndex.mockClear();
    update({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: 3 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: "auto" });
  });

  it("選択が同じまま行位置だけ変わっても(列数・タイルサイズの変化)スクロールしない", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    virtualizer.scrollToIndex.mockClear();
    update({ selectedRowIndex: 1 });
    update({ selectedRowIndex: 5 });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  it("resetKeyが変わったとき、選択作品が一覧にあればその行へ寄せる", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    virtualizer.scrollToIndex.mockClear();
    update({ resetKey: "key-2", selectedIndex: 2, selectedRowIndex: 1 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(1, { align: "auto" });
    expect(virtualizer.scrollToOffset).not.toHaveBeenCalled();
  });

  it("resetKeyが変わったとき、選択が無ければ先頭へ戻す", () => {
    const { virtualizer, update } = setup();
    update({ resetKey: "key-2" });
    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0);
  });

  it("resetKeyが変わったとき、選択作品が一覧に無ければ先頭へ戻す", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 3,
    });
    virtualizer.scrollToIndex.mockClear();
    update({ resetKey: "key-2", selectedIndex: -1, selectedRowIndex: undefined });
    expect(virtualizer.scrollToOffset).toHaveBeenCalledWith(0);
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it("resetKey変化の先頭リセットは一度だけで、以降の再描画では動かさない", () => {
    const { virtualizer, update } = setup();
    update({ resetKey: "key-2" });
    update({ resetKey: "key-2" });
    update({ resetKey: "key-2", selectedRowIndex: undefined });
    expect(virtualizer.scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it("行位置が未解決の間は保留し、解決できた時点で一度だけ寄せる", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: undefined,
    });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    update({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: undefined });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    update({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: 3 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: "auto" });
    update({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: 4 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it("選択作品が一覧に無いまま寸法が確定したら要求を取り下げ、後から一覧に入ってもスクロールしない", () => {
    const { virtualizer, update } = setup({ selectedWorkId: "w700" });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    update({ selectedWorkId: "w700", selectedIndex: 700, selectedRowIndex: 350 });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it("寸法が確定するまで保留する", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: 0,
      isLayoutReady: false,
    });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
    update({ selectedWorkId: "w7", selectedIndex: 7, selectedRowIndex: 3, isLayoutReady: true });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(3, { align: "auto" });
  });

  it("保留中に選択が解除されたら、要求を取り下げる", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: undefined,
    });
    update({ selectedWorkId: null, selectedIndex: -1 });
    update({ selectedWorkId: null, selectedIndex: 7, selectedRowIndex: 3 });
    expect(virtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it("保留中に次のきっかけが来たら上書きする", () => {
    const { virtualizer, update } = setup({
      selectedWorkId: "w7",
      selectedIndex: 7,
      selectedRowIndex: undefined,
    });
    update({ selectedWorkId: "w9", selectedIndex: 9, selectedRowIndex: 4 });
    expect(virtualizer.scrollToIndex).toHaveBeenCalledTimes(1);
    expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(4, { align: "auto" });
  });
});
