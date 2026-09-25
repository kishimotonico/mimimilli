import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnregisterMissingWorksResult } from "@mimimilli/shared";
import * as workApi from "../../src/entities/work/api";
import { ErrorViewBulkUnregisterBanner } from "../../src/features/library/ui/ErrorViewBulkUnregisterBanner";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorViewBulkUnregisterBanner", () => {
  it("一括登録解除の完了前にアンマウントされても、成功すればonUnregisteredを呼ぶ", async () => {
    let resolveUnregister!: (result: UnregisterMissingWorksResult) => void;
    vi.spyOn(workApi, "unregisterMissingWorks").mockReturnValue(
      new Promise((resolve) => {
        resolveUnregister = resolve;
      }),
    );
    const onUnregistered = vi.fn();
    const view = render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(ErrorViewBulkUnregisterBanner, { missingCount: 2, onUnregistered }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "欠損作品をまとめて登録解除" }));
    fireEvent.click(screen.getByRole("button", { name: "まとめて解除する" }));
    await waitFor(() => expect(workApi.unregisterMissingWorks).toHaveBeenCalled());
    view.unmount();
    resolveUnregister({} as UnregisterMissingWorksResult);

    await waitFor(() => expect(onUnregistered).toHaveBeenCalledTimes(1));
  });
});
