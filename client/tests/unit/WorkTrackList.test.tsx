import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ResolvedTrack } from "@mimimilli/shared";
import { WorkTrackList } from "../../src/features/library/ui/preview/WorkTrackList";

afterEach(() => cleanup());

function makeTracks(count: number): ResolvedTrack[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    title: `トラック${i}`,
    file: `t${i}.mp3`,
    durationSec: 120,
    durationKind: "resolved",
  }));
}

function renderList(overrides: Partial<React.ComponentProps<typeof WorkTrackList>> = {}) {
  const onPlay = vi.fn();
  render(
    <WorkTrackList
      tracks={makeTracks(3)}
      isPlayable
      playingTrackIndex={null}
      hasResume={false}
      resumeTrackId={null}
      resumeOffsetSec={0}
      onPlay={onPlay}
      {...overrides}
    />,
  );
  return { onPlay };
}

describe("WorkTrackList のキーボード操作", () => {
  it("roving tabindexで最初はトラック0だけがTabストップになる", () => {
    renderList();
    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveAttribute("tabindex", "0");
    expect(rows[1]).toHaveAttribute("tabindex", "-1");
    expect(rows[2]).toHaveAttribute("tabindex", "-1");
  });

  it("再生中のトラックがあれば、初期のroving位置はそこになる", () => {
    renderList({ playingTrackIndex: 2 });
    const rows = screen.getAllByRole("button");
    expect(rows[2]).toHaveAttribute("tabindex", "0");
  });

  it("ArrowDown/ArrowUpで次/前の行へフォーカスが移り、rovingも追従する", () => {
    renderList();
    const rows = screen.getAllByRole("button");
    rows[0]?.focus();
    fireEvent.keyDown(rows[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1]).toHaveAttribute("tabindex", "0");
    expect(rows[0]).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(rows[1]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("End/Homeで末尾・先頭へ移動する", () => {
    renderList();
    const rows = screen.getAllByRole("button");
    rows[0]?.focus();
    fireEvent.keyDown(rows[0]!, { key: "End" });
    expect(document.activeElement).toBe(rows[2]);

    fireEvent.keyDown(rows[2]!, { key: "Home" });
    expect(document.activeElement).toBe(rows[0]);
  });

  it("Enter相当のクリックでそのトラックを再生する", () => {
    const { onPlay } = renderList();
    const rows = screen.getAllByRole("button");
    fireEvent.click(rows[1]!);
    expect(onPlay).toHaveBeenCalledWith(1);
  });

  it("再生不可のときは全行disabledでロービングも無効になる", () => {
    renderList({ isPlayable: false });
    const rows = screen.getAllByRole("button");
    rows.forEach((row) => expect(row).toBeDisabled());
  });
});
