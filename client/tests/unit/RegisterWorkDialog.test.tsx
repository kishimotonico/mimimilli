import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkRegisterPreview } from "@mimimilli/shared";
import RegisterWorkDialog from "../../src/features/files/ui/RegisterWorkDialog";

const preview: WorkRegisterPreview = {
  suggestedTitle: "テスト作品",
  tags: [],
  detectedRjCode: null,
  descendantWorkCount: 0,
  alreadyRegistered: false,
  orphanedMeta: false,
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return render(
    <RegisterWorkDialog
      folderPath="/music/test"
      preview={preview}
      onRegistered={vi.fn()}
      onClose={vi.fn()}
    />,
    { wrapper },
  );
}

describe("RegisterWorkDialog", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/tags")) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/tag-prefixes")) {
          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("RJ/VJコード未入力で取得を押すとバリデーション文言を表示する", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "取得" }));

    expect(screen.getByText("RJ/VJコードを入力してください")).toBeTruthy();
    expect(screen.queryByText("DLsite情報の取得に失敗しました")).toBeNull();
  });
});
