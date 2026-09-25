import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaybackRatePicker from "../../src/features/player/ui/PlaybackRatePicker";

describe("PlaybackRatePicker", () => {
  it("開いたら選択中の項目（aria-checked=true）へフォーカスが移る", async () => {
    render(<PlaybackRatePicker playbackRate={1.25} onSetPlaybackRate={vi.fn()} />);

    fireEvent.click(screen.getByTitle("再生速度"));

    await waitFor(() => {
      const checked = screen.getByRole("menuitemradio", { checked: true });
      expect(checked).toHaveFocus();
    });
  });
});
