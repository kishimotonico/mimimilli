import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { DataIntegrityWarningBanner } from "../../src/features/library/ui/DataIntegrityWarningBanner";
import { apiError, mockApi } from "../helpers/api";
import { buildScanDiagnostics } from "../helpers/builders";

afterEach(cleanup);

function renderBanner() {
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(DataIntegrityWarningBanner),
    ),
  );
}

describe("DataIntegrityWarningBanner", () => {
  it("診断の件数ぶん、除外された作品数を出す", async () => {
    mockApi({
      "GET /api/scan/diagnostics": buildScanDiagnostics({ dataIntegrityWorkIds: ["a", "b"] }),
    });
    renderBanner();
    expect(
      await screen.findByText("2件の作品がデータ不整合のため除外されました"),
    ).toBeInTheDocument();
  });

  it("0件なら出さない", async () => {
    const api = mockApi({ "GET /api/scan/diagnostics": buildScanDiagnostics() });
    renderBanner();
    await waitFor(() => expect(api.requestsTo("GET /api/scan/diagnostics")).toHaveLength(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("読み込み中は出さない", () => {
    mockApi({ "GET /api/scan/diagnostics": () => new Promise(() => {}) });
    renderBanner();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("取得に失敗したら警告を出し、再試行で取り直す", async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockApi({
      "GET /api/scan/diagnostics": () => {
        calls += 1;
        return calls === 1
          ? apiError(500, "internal", "boom")
          : buildScanDiagnostics({ dataIntegrityWorkIds: ["a"] });
      },
    });
    renderBanner();
    expect(await screen.findByText("データ不整合を確認できません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(
      await screen.findByText("1件の作品がデータ不整合のため除外されました"),
    ).toBeInTheDocument();
  });
});
