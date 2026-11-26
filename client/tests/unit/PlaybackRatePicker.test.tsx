import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PlaybackRatePicker from "../../src/features/player/ui/PlaybackRatePicker";

describe("PlaybackRatePicker", () => {
  it("開くと現在の速度が選択中で、選ぶと速度を変えて閉じる", async () => {
    const onSetPlaybackRate = vi.fn();
    render(<PlaybackRatePicker playbackRate={1.25} onSetPlaybackRate={onSetPlaybackRate} />);

    await userEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menuitemradio", { checked: true })).toHaveTextContent("1.25×");

    await userEvent.click(screen.getByRole("menuitemradio", { name: "2.0×" }));
    expect(onSetPlaybackRate).toHaveBeenCalledWith(2);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
