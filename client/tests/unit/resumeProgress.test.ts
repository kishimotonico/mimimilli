import { describe, expect, it } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import {
  computeResumeProgressRatio,
  resumeProgressBarWidth,
} from "../../src/entities/work/resumeProgress";

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 300,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          { id: "t1", title: "1", file: "1.mp3", durationSec: 100, durationKind: "resolved" },
          { id: "t2", title: "2", file: "2.mp3", durationSec: 100, durationKind: "resolved" },
          { id: "t3", title: "3", file: "3.mp3", durationSec: 100, durationKind: "resolved" },
        ],
      },
    ],
    resume: null,
    ...overrides,
  };
}

describe("computeResumeProgressRatio", () => {
  it("resumeが無ければnull", () => {
    expect(computeResumeProgressRatio(makeWork({ resume: null }))).toBeNull();
  });

  it("先頭トラックの途中なら、そのトラック内の位置÷合計時間", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t1", offsetSec: 50 } });
    // 50 / 300 = 0.1666...
    expect(computeResumeProgressRatio(work)).toBeCloseTo(50 / 300, 5);
  });

  it("2番目のトラックの途中なら、前トラック分を積み上げた位置÷合計時間", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t2", offsetSec: 20 } });
    // (100 + 20) / 300
    expect(computeResumeProgressRatio(work)).toBeCloseTo(120 / 300, 5);
  });

  it("最終トラックの終端付近なら1に近い値", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t3", offsetSec: 95 } });
    expect(computeResumeProgressRatio(work)).toBeCloseTo(295 / 300, 5);
  });

  it("offsetSecが合計を超えても1でクランプする", () => {
    const work = makeWork({ resume: { playlistId, trackId: "t3", offsetSec: 9999 } });
    expect(computeResumeProgressRatio(work)).toBe(1);
  });

  it("resumeが指すプレイリストが見つからなければnull", () => {
    const work = makeWork({ resume: { playlistId: "not-found", trackId: "t1", offsetSec: 1 } });
    expect(computeResumeProgressRatio(work)).toBeNull();
  });

  it("resumeが指すトラックが見つからなければnull", () => {
    const work = makeWork({ resume: { playlistId, trackId: "not-found", offsetSec: 1 } });
    expect(computeResumeProgressRatio(work)).toBeNull();
  });

  it("途中のトラックにdurationSec未計測（null）があれば割合を出さない", () => {
    const work = makeWork({
      playlists: [
        {
          id: playlistId,
          name: "default",
          tracks: [
            { id: "t1", title: "1", file: "1.mp3", durationSec: null, durationKind: "unmeasured" },
            { id: "t2", title: "2", file: "2.mp3", durationSec: 100, durationKind: "resolved" },
          ],
        },
      ],
      resume: { playlistId, trackId: "t2", offsetSec: 10 },
    });
    expect(computeResumeProgressRatio(work)).toBeNull();
  });
});

describe("resumeProgressBarWidth", () => {
  it("極小割合でも最小8pxを保証するCSS width値を返す", () => {
    expect(resumeProgressBarWidth(0.005)).toBe("max(8px, 0.5%)");
  });

  it("十分な割合ならそのままのパーセントを含む（8pxが実質効かない大きさでも式は一貫してmax()を返す）", () => {
    expect(resumeProgressBarWidth(0.55)).toBe("max(8px, 55%)");
  });

  it("0でも最小幅の式自体は保つ（呼び出し側でratio===0のケースは通常発生しない）", () => {
    expect(resumeProgressBarWidth(0)).toBe("max(8px, 0%)");
  });

  it("1（満了）なら100%を含む", () => {
    expect(resumeProgressBarWidth(1)).toBe("max(8px, 100%)");
  });
});
