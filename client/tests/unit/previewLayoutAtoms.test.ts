import { describe, expect, it } from "vitest";
import {
  clampFilesPreviewWidth,
  FILES_LIST_MIN_WIDTH,
  FILES_PREVIEW_WIDTH_MAX,
  FILES_PREVIEW_WIDTH_MIN,
  getEffectiveFilesPreviewWidthMax,
} from "../../src/features/files/model/previewLayoutAtoms";

describe("getEffectiveFilesPreviewWidthMax", () => {
  it("コンテナ幅が未測定（null）なら固定上限をそのまま使う", () => {
    expect(getEffectiveFilesPreviewWidthMax(null)).toBe(FILES_PREVIEW_WIDTH_MAX);
  });

  it("コンテナ幅が十分に広ければ固定上限（720px）を使う", () => {
    expect(getEffectiveFilesPreviewWidthMax(1440)).toBe(FILES_PREVIEW_WIDTH_MAX);
    expect(getEffectiveFilesPreviewWidthMax(FILES_PREVIEW_WIDTH_MAX + FILES_LIST_MIN_WIDTH)).toBe(
      FILES_PREVIEW_WIDTH_MAX,
    );
  });

  it("コンテナ幅721〜979pxでは、一覧の最小幅(260px)を残した値に上限が下がる", () => {
    expect(getEffectiveFilesPreviewWidthMax(900)).toBe(900 - FILES_LIST_MIN_WIDTH);
    expect(getEffectiveFilesPreviewWidthMax(721)).toBe(721 - FILES_LIST_MIN_WIDTH);
  });

  it("コンテナ幅が極端に狭くても、上限がプレビューの最小幅を下回らない", () => {
    expect(getEffectiveFilesPreviewWidthMax(400)).toBe(FILES_PREVIEW_WIDTH_MIN);
  });
});

describe("clampFilesPreviewWidth", () => {
  it("実効上限（maxを渡した場合）で丸める", () => {
    expect(clampFilesPreviewWidth(720, 640)).toBe(640);
    expect(clampFilesPreviewWidth(500, 640)).toBe(500);
  });

  it("maxを省略すると固定上限（720px）で丸める", () => {
    expect(clampFilesPreviewWidth(900)).toBe(FILES_PREVIEW_WIDTH_MAX);
  });

  it("最小幅を下回らない", () => {
    expect(clampFilesPreviewWidth(100, 640)).toBe(FILES_PREVIEW_WIDTH_MIN);
  });
});
