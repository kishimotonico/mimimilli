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
    cover: null,
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
  it("total が渡されたとき、works.length ではなく total を表示する", () => {
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

  it("total が未確定のときは件数テキストを描画しない", () => {
    render(
      <AxisLanding presentation={presentation} works={createWorks(12)} onSelectWork={() => {}} />,
    );

    expect(screen.queryByText(/\d+ 件/)).toBeNull();
  });

  it("total が 0 のときは 0 件と表示する", () => {
    render(
      <AxisLanding presentation={presentation} works={[]} total={0} onSelectWork={() => {}} />,
    );

    expect(screen.getByText("0 件")).toBeTruthy();
  });
});
