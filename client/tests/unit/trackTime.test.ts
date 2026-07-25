import { describe, expect, it } from "vitest";
import type { ResolvedTrack, Track } from "../../src/entities/work/model";
import {
  getTrackDurationSec,
  hasReachedTrackEnd,
  isResolvedTrack,
  toAudioAbsoluteTime,
  toTrackRelativeTime,
} from "../../src/features/player/model/trackTime";

const segment: Track = {
  title: "区間トラック",
  file: "audio.wav",
  start: 30,
  end: 90,
};

describe("trackTime", () => {
  it("start/end 付きトラックの duration を区間長にする", () => {
    expect(getTrackDurationSec(segment, 120)).toBe(60);
  });

  it("end がない場合はファイル末尾までを duration にする", () => {
    expect(getTrackDurationSec({ ...segment, end: undefined }, 120)).toBe(90);
  });

  it("start/end がない場合は従来どおりファイル全体の duration にする", () => {
    const wholeFile: Track = { title: "全体", file: "audio.wav" };
    expect(getTrackDurationSec(wholeFile, 120)).toBe(120);
    expect(toTrackRelativeTime(45, wholeFile, 120)).toBe(45);
    expect(toAudioAbsoluteTime(45, wholeFile, 120)).toBe(45);
  });

  it("ファイル全体長が未知（null）なら duration も未知にする", () => {
    const wholeFile: Track = { title: "全体", file: "audio.wav" };
    expect(getTrackDurationSec(wholeFile, null)).toBeNull();
  });

  it("絶対時刻をトラック相対時刻へ変換して区間内にクランプする", () => {
    expect(toTrackRelativeTime(45, segment, 60)).toBe(15);
    expect(toTrackRelativeTime(10, segment, 60)).toBe(0);
    expect(toTrackRelativeTime(100, segment, 60)).toBe(60);
  });

  it("trackDurationSec が null なら相対時刻の上限クランプをしない", () => {
    expect(toTrackRelativeTime(1000, segment, null)).toBe(970);
  });

  it("相対シーク時刻を絶対時刻へ変換して区間内にクランプする", () => {
    expect(toAudioAbsoluteTime(15, segment, 60)).toBe(45);
    expect(toAudioAbsoluteTime(-10, segment, 60)).toBe(30);
    expect(toAudioAbsoluteTime(100, segment, 60)).toBe(90);
  });

  it("end 付きトラックだけ絶対時刻による区間終了を検知する", () => {
    expect(hasReachedTrackEnd(89.99, segment)).toBe(false);
    expect(hasReachedTrackEnd(90, segment)).toBe(true);
    expect(hasReachedTrackEnd(120, { ...segment, end: undefined })).toBe(false);
  });

  it("durationSec を持つ ResolvedTrack は登録トラックと判定する", () => {
    const resolved: ResolvedTrack = { ...segment, durationSec: 60 };
    expect(isResolvedTrack(resolved)).toBe(true);
    expect(isResolvedTrack(segment)).toBe(false);
  });

  it("登録トラックは filesModeFileDurationSec を無視し DTO の durationSec をそのまま使う", () => {
    const resolved: ResolvedTrack = { ...segment, durationSec: 60 };
    expect(getTrackDurationSec(resolved, null)).toBe(60);
    expect(getTrackDurationSec(resolved, 9999)).toBe(60);
  });

  it("登録トラックの durationSec が null（計測不能）なら未知のまま", () => {
    const resolved: ResolvedTrack = { ...segment, durationSec: null };
    expect(getTrackDurationSec(resolved, 120)).toBeNull();
  });
});
