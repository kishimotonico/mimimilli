// TagPrefixSettings: 削除確認・保護中の削除禁止・並び順入れ替えを確認する。
import { createElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import TagPrefixSettings from "../../src/features/settings/ui/TagPrefixSettings";
import { apiNoContent, mockApi, type ApiMock } from "../helpers/api";
import { buildTagPrefix } from "../helpers/builders";

const PREFIXES: TagPrefix[] = [
  buildTagPrefix({ prefix: "cv", label: "CV", color: "cv", protected: true, order: 0 }),
  buildTagPrefix({ prefix: "気分", label: "気分", color: null, protected: false, order: 1 }),
];

let api: ApiMock;

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
    api = mockApi({
      "GET /api/tag-prefixes": PREFIXES,
      "GET /api/tag-prefixes/candidates": [],
      "PATCH /api/tag-prefixes/:prefix": ({ params }) =>
        PREFIXES.find((prefix) => prefix.prefix === params.prefix),
      "PUT /api/tag-prefixes/order": ({ body }) => {
        const { prefixes } = body as { prefixes: string[] };
        return prefixes.map((name) => PREFIXES.find((prefix) => prefix.prefix === name));
      },
      "DELETE /api/tag-prefixes/:prefix": () => apiNoContent(),
    });
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
    expect(api.requestsTo("DELETE /api/tag-prefixes/:prefix")).toHaveLength(0);

    fireEvent.click(button);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/気分\/ タグ自体は消えません/)).toBeInTheDocument();
    expect(api.requestsTo("DELETE /api/tag-prefixes/:prefix")).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(api.requestsTo("DELETE /api/tag-prefixes/:prefix")[0]?.params.prefix).toBe("気分"),
    );
  });

  it("上へ移動すると全prefixの新しい順序を一括で送る", async () => {
    renderSettings();
    const upButton = await screen.findByRole("button", { name: "「気分」を上へ移動" });
    fireEvent.click(upButton);

    await waitFor(() =>
      expect(api.requestsTo("PUT /api/tag-prefixes/order")[0]?.body).toEqual({
        prefixes: ["気分", "cv"],
      }),
    );
    expect(api.requestsTo("PATCH /api/tag-prefixes/:prefix")).toHaveLength(0);
  });

  it("ラベル編集はIME変換中のEnterで確定せず、変換後のEnterで確定する", async () => {
    renderSettings();
    const [labelButton] = await screen.findAllByTitle("クリックしてラベルを編集");
    fireEvent.click(labelButton);
    const input = screen.getByLabelText(/のラベル$/);
    fireEvent.change(input, { target: { value: "あたらしい" } });

    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(api.requestsTo("PATCH /api/tag-prefixes/:prefix")).toHaveLength(0);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.requestsTo("PATCH /api/tag-prefixes/:prefix")).toHaveLength(1));
    expect(api.requestsTo("PATCH /api/tag-prefixes/:prefix")[0]?.body).toEqual({
      label: "あたらしい",
    });
  });
});
