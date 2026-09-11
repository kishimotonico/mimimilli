import { describe, expect, it, vi } from "vitest";
import { buildRootFolderChangedToastRequest } from "../../src/app/model/rootFolderChangedToast";

describe("buildRootFolderChangedToastRequest", () => {
  it("成功メッセージと「今すぐスキャン」アクションを持つ要求を作る", () => {
    const onOpenScan = vi.fn();
    const request = buildRootFolderChangedToastRequest(onOpenScan);

    expect(request.message).toBe(
      "ルートフォルダーを変更しました。新しいフォルダーを読み込むにはスキャンしてください。",
    );
    expect(request.variant).toBe("success");
    expect(request.actionLabel).toBe("今すぐスキャン");

    request.onAction?.();
    expect(onOpenScan).toHaveBeenCalledTimes(1);
  });
});
