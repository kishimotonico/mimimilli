import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkSummary } from "../../src/entities/work/model";
import { selectFixedCoverThumbnailWidth } from "../../src/entities/work/ui/coverThumbnailWidth";
import WorkRow from "../../src/features/library/ui/WorkRow";

describe("selectFixedCoverThumbnailWidth", () => {
  it.each([
    // [表示サイズ, DPR, 期待幅] — 表示サイズxDPR以上の最小許可幅（ceil）
    [32, 1, 128],
    [32, 2, 128],
    [32, 3, 128],
    [46, 2, 128],
    [80, 1, 128],
    [80, 2, 256],
    [140, 1, 256],
    [140, 2, 512],
    [308, 1, 512],
    [320, 1, 512],
  ])("size=%d dpr=%d -> %d", (size, dpr, expected) => {
    expect(selectFixedCoverThumbnailWidth(size, dpr)).toBe(expected);
  });

  it("許可幅の境界ではその幅を返し、1px超えると次の幅を返す", () => {
    expect(selectFixedCoverThumbnailWidth(128, 1)).toBe(128);
    expect(selectFixedCoverThumbnailWidth(129, 1)).toBe(256);
    expect(selectFixedCoverThumbnailWidth(256, 1)).toBe(256);
    expect(selectFixedCoverThumbnailWidth(257, 1)).toBe(512);
  });

  it("512pxを超える要求には最大幅512を返す", () => {
    expect(selectFixedCoverThumbnailWidth(320, 2)).toBe(512);
    expect(selectFixedCoverThumbnailWidth(1000, 1)).toBe(512);
  });

  it("DPRが1未満でも1として扱う", () => {
    expect(selectFixedCoverThumbnailWidth(80, 0)).toBe(128);
  });
});

describe("WorkRow のカバー画像", () => {
  const workWithCover: WorkSummary = {
    id: "work-1",
    title: "Work 1",
    cover: { image: "cover.jpg", dimensions: { width: 800, height: 600 } },
    status: "ok",
    physicalPath: "/audio/work-1",
    totalDurationSec: 120,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
  };

  function renderRow(work: WorkSummary) {
    return render(createElement(WorkRow, { work, isSelected: false, onSelect: vi.fn() }));
  }

  it("サムネイルURL（許可幅の?w=指定）をloading=lazyで要求する", () => {
    const { container } = renderRow(workWithCover);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("loading", "lazy");
    const src = img?.getAttribute("src") ?? "";
    expect(src).toContain("/api/media/cover/work-1");
    expect(src).toMatch(/\?w=(128|256|512)$/);
  });

  it("カバーなし作品はプレースホルダー表示のまま（imgを出さない）", () => {
    const { container } = renderRow({ ...workWithCover, cover: null });
    expect(container.querySelector("img")).toBeNull();
  });
});
