import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Track } from "@mimimilli/shared";
import { WorkPlayButton } from "../../src/features/library/ui/preview/WorkPlayButton";

afterEach(cleanup);

function makeTrack(): Track {
  return { id: "t1", title: "track1", file: "track1.mp3" };
}

function renderButton(props: Partial<React.ComponentProps<typeof WorkPlayButton>> = {}) {
  return render(
    <WorkPlayButton
      hasResume={false}
      isPlayable={true}
      isLoaded={false}
      isPlaying={false}
      resumeTrack={null}
      resumeTime="0:00"
      onPlayFromStart={vi.fn()}
      onResume={vi.fn()}
      onTogglePlay={vi.fn()}
      {...props}
    />,
  );
}

describe("WorkPlayButton", () => {
  it("履歴なし・非ロード: 「最初から再生」を主ボタンに出し、▾は省略する", async () => {
    const onPlayFromStart = vi.fn();
    const user = userEvent.setup();
    renderButton({ hasResume: false, isLoaded: false, onPlayFromStart });

    const main = screen.getByRole("button", { name: "最初から再生" });
    expect(screen.getByText("再生")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "再生メニュー" })).toBeNull();

    await user.click(main);
    expect(onPlayFromStart).toHaveBeenCalledTimes(1);
  });

  it("履歴あり・非ロード: 「続きから再生」を主ボタンに出し、▾から最初から再生を選べる", async () => {
    const onResume = vi.fn();
    const onPlayFromStart = vi.fn();
    const user = userEvent.setup();
    renderButton({
      hasResume: true,
      isLoaded: false,
      resumeTrack: makeTrack(),
      resumeTime: "1:23:45",
      onResume,
      onPlayFromStart,
    });

    const main = screen.getByRole("button", { name: "続きから再生" });
    expect(screen.getByText("続きから")).toBeTruthy();
    // 時間テキストはボタンに載せない
    expect(screen.queryByText("1:23:45")).toBeNull();

    await user.click(main);
    expect(onResume).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "再生メニュー" }));
    const item = screen.getByRole("menuitem", { name: "最初から再生" });
    expect(item).toBeTruthy();
    await user.click(item);
    expect(onPlayFromStart).toHaveBeenCalledTimes(1);
    // メニューはクリックで閉じる
    expect(screen.queryByRole("menuitem", { name: "最初から再生" })).toBeNull();
  });

  it("再生中（ロード中かつisPlaying）: 主ボタンは一時停止トグルになる", async () => {
    const onTogglePlay = vi.fn();
    const user = userEvent.setup();
    renderButton({ hasResume: true, isLoaded: true, isPlaying: true, onTogglePlay });

    const main = screen.getByRole("button", { name: "一時停止" });
    expect(screen.getByText("一時停止")).toBeTruthy();

    await user.click(main);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("一時停止中（ロード中だがisPlaying=false）: 主ボタンは▶に戻りトグルで再開する", async () => {
    const onTogglePlay = vi.fn();
    const user = userEvent.setup();
    renderButton({ hasResume: true, isLoaded: true, isPlaying: false, onTogglePlay });

    const main = screen.getByRole("button", { name: "再生を再開" });
    expect(screen.getByText("再生")).toBeTruthy();

    await user.click(main);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("ロード中は履歴の有無に関わらず▾（最初から再生）を出す", () => {
    renderButton({ hasResume: false, isLoaded: true, isPlaying: true });
    expect(screen.getByRole("button", { name: "再生メニュー" })).toBeTruthy();
  });

  it("再生不可（isPlayable=false）: 主ボタンは無効化され▾も出さない", () => {
    renderButton({ isPlayable: false, hasResume: true, isLoaded: false });
    expect(screen.getByRole("button", { name: "最初から再生" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "再生メニュー" })).toBeNull();
  });

  it("▾メニューは開くとメニュー項目へフォーカスし、Escapeで閉じてスプリットボタン内へフォーカスが戻る", async () => {
    const user = userEvent.setup();
    renderButton({ hasResume: true, isLoaded: false });

    const trigger = screen.getByRole("button", { name: "再生メニュー" });
    await user.click(trigger);
    const item = screen.getByRole("menuitem", { name: "最初から再生" });
    expect(item).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    // usePopoverDismissalの共通仕様: bodyにフォーカスが落ちていればanchor内の
    // 最初のフォーカス可能要素（=主ボタン）へ戻す
    expect(screen.getByRole("button", { name: "続きから再生" })).toHaveFocus();
  });
});
