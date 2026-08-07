import { describe, expect, it, vi } from "vitest";
import {
  deriveValueSelectionHandlers,
  type ValueSelectionIntent,
} from "../../src/features/library/model/valueSelectionContract";

describe("deriveValueSelectionHandlers（値選択の契約。ADR-0013）", () => {
  it("既定=置き換え: 主クリックは onReplace を呼ぶ", () => {
    const onReplace = vi.fn();
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const intent: ValueSelectionIntent<string> = {
      default: "replace",
      onReplace,
      onToggle,
      onAdd,
    };
    const { onSelect } = deriveValueSelectionHandlers(intent);

    onSelect("cv/藤田茜", { ctrlKey: false, metaKey: false });

    expect(onReplace).toHaveBeenCalledWith("cv/藤田茜");
    expect(onToggle).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("既定=置き換え: Ctrl/Cmd+クリックは onToggle へ反転する", () => {
    const onReplace = vi.fn();
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const intent: ValueSelectionIntent<string> = {
      default: "replace",
      onReplace,
      onToggle,
      onAdd,
    };
    const { onSelect } = deriveValueSelectionHandlers(intent);

    onSelect("cv/藤田茜", { ctrlKey: true, metaKey: false });
    onSelect("cv/藤田茜", { ctrlKey: false, metaKey: true });

    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onReplace).not.toHaveBeenCalled();
  });

  it("既定=置き換え: 追加ボタンは onAdd を呼ぶ", () => {
    const onReplace = vi.fn();
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const intent: ValueSelectionIntent<string> = {
      default: "replace",
      onReplace,
      onToggle,
      onAdd,
    };
    const { onAddButton } = deriveValueSelectionHandlers(intent);

    onAddButton("cv/藤田茜");

    expect(onAdd).toHaveBeenCalledWith("cv/藤田茜");
    expect(onReplace).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("既定=AND追加: 主クリックは onAdd を呼ぶ", () => {
    const onAdd = vi.fn();
    const onReplace = vi.fn();
    const intent: ValueSelectionIntent<string> = { default: "add", onAdd, onReplace };
    const { onSelect } = deriveValueSelectionHandlers(intent);

    onSelect("cv/藤田茜", { ctrlKey: false, metaKey: false });

    expect(onAdd).toHaveBeenCalledWith("cv/藤田茜");
    expect(onReplace).not.toHaveBeenCalled();
  });

  it("既定=AND追加: Ctrl/Cmd+クリックは onReplace へ反転する", () => {
    const onAdd = vi.fn();
    const onReplace = vi.fn();
    const intent: ValueSelectionIntent<string> = { default: "add", onAdd, onReplace };
    const { onSelect } = deriveValueSelectionHandlers(intent);

    onSelect("cv/藤田茜", { ctrlKey: true, metaKey: false });

    expect(onReplace).toHaveBeenCalledWith("cv/藤田茜");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("既定=AND追加: 導出結果に追加ボタンのハンドラを持たない（不正な組み合わせを型で表現できない）", () => {
    const intent: ValueSelectionIntent<string> = {
      default: "add",
      onAdd: vi.fn(),
      onReplace: vi.fn(),
    };
    const handlers = deriveValueSelectionHandlers(intent);

    expect("onAddButton" in handlers).toBe(false);
  });
});
