import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import type { SmartFolder } from "@mimimilli/shared";
import { SmartFolderView } from "../../src/features/library/ui/preview/SmartFolderView";

afterEach(cleanup);

const smartFolder: SmartFolder = {
  id: "sf-1",
  name: "テストフォルダ",
  rules: [],
};

describe("SmartFolderView の件数表示", () => {
  it("total が渡されたとき件数を表示する", () => {
    render(<SmartFolderView sf={smartFolder} total={120} onEdit={() => {}} />);

    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText(/件マッチ/)).toBeTruthy();
  });

  it("total が未確定のときは件数テキストを描画しない", () => {
    render(<SmartFolderView sf={smartFolder} onEdit={() => {}} />);

    expect(screen.queryByText(/件マッチ/)).toBeNull();
  });

  it("total が 0 のときは 0 件マッチと表示する", () => {
    render(<SmartFolderView sf={smartFolder} total={0} onEdit={() => {}} />);

    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText(/件マッチ/)).toBeTruthy();
  });
});
