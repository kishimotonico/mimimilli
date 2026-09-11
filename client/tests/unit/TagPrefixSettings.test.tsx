// TagPrefixSettings: 削除確認・保護中の削除禁止・並び順入れ替えを確認する。
import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import TagPrefixSettings from "../../src/features/settings/ui/TagPrefixSettings";

const listTagPrefixes = vi.fn();
const listTagPrefixCandidates = vi.fn();
const createTagPrefix = vi.fn();
const updateTagPrefix = vi.fn();
const reorderTagPrefixes = vi.fn();
const deleteTagPrefix = vi.fn();

vi.mock("../../src/entities/tag/api", () => ({
  listTagPrefixes: (...args: unknown[]) => listTagPrefixes(...args),
  listTagPrefixCandidates: (...args: unknown[]) => listTagPrefixCandidates(...args),
  createTagPrefix: (...args: unknown[]) => createTagPrefix(...args),
  updateTagPrefix: (...args: unknown[]) => updateTagPrefix(...args),
  reorderTagPrefixes: (...args: unknown[]) => reorderTagPrefixes(...args),
  deleteTagPrefix: (...args: unknown[]) => deleteTagPrefix(...args),
}));

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true, order: 0 },
  {
    prefix: "気分",
    label: "気分",
    color: null,
    showAsAxis: true,
    protected: false,
    order: 1,
  },
];

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(TagPrefixSettings)),
  );
}

describe("TagPrefixSettings", () => {
  beforeEach(() => {
    listTagPrefixes.mockReset().mockResolvedValue(PREFIXES);
    listTagPrefixCandidates.mockReset().mockResolvedValue([]);
    createTagPrefix.mockReset();
    updateTagPrefix.mockReset().mockResolvedValue(undefined);
    reorderTagPrefixes.mockReset().mockResolvedValue(undefined);
    deleteTagPrefix.mockReset().mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it("保護中のprefixは削除ボタンが無効で理由がtitleに出る", async () => {
    renderSettings();
    const button = await screen.findByRole("button", { name: "prefix「cv」を削除" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "保護中のprefixは削除できません。削除するには「保護」のチェックを外してください",
    );
  });

  it("保護されていないprefixは確認ダイアログを経由して削除する", async () => {
    renderSettings();
    const button = await screen.findByRole("button", { name: "prefix「気分」を削除" });
    expect(deleteTagPrefix).not.toHaveBeenCalled();

    fireEvent.click(button);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/気分\/ タグ自体は消えません/)).toBeInTheDocument();
    expect(deleteTagPrefix).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(deleteTagPrefix).toHaveBeenCalledWith("気分"));
  });

  it("上へ移動すると全prefixの新しい順序を一括で送る", async () => {
    renderSettings();
    const upButton = await screen.findByRole("button", { name: "「気分」を上へ移動" });
    fireEvent.click(upButton);

    await waitFor(() => expect(reorderTagPrefixes).toHaveBeenCalledWith(["気分", "cv"]));
    expect(updateTagPrefix).not.toHaveBeenCalled();
  });
});
