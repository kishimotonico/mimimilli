// TASK-88: axis-landing プレビューのページング200件頭打ち対策。
// /works はページングエンベロープの total を返す（WORKS_DEFAULT_PAGE_SIZE=200 上限）ため、
// 件数表示は読み込み済み works.length ではなく total を優先する（smartFolderView と同じ設計）。

import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import type { WorkListItem } from "@mimimilli/shared";
import { AxisLanding } from "../../src/features/library/ui/preview/AxisLanding";

afterEach(cleanup);

function createWorks(count: number): WorkListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `work-${i}`,
    title: `作品 ${i}`,
    coverImage: null,
    status: "ok",
    totalDurationSec: 0,
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
  }));
}

const presentation = {
  panelTitle: "概要",
  sectionTitle: "サークル",
  instruction: null,
};

describe("AxisLanding の件数表示", () => {
  it("total が渡されたとき、works.length ではなく total を表示する（200件頭打ち対策）", () => {
    render(
      <AxisLanding
        presentation={presentation}
        works={createWorks(200)}
        total={350}
        onSelectWork={() => {}}
      />,
    );

    expect(screen.getByText("350 件")).toBeTruthy();
    expect(screen.queryByText("200 件")).toBeNull();
  });

  it("total が未指定のときは works.length にフォールバックする", () => {
    render(
      <AxisLanding presentation={presentation} works={createWorks(12)} onSelectWork={() => {}} />,
    );

    expect(screen.getByText("12 件")).toBeTruthy();
  });
});
